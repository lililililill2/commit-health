import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { koreanDay } from '../../common/korean-day.js';
import type { ActivityKind, ActivitySession } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityClock } from './activity-clock.js';
import {
  STRETCH_DIRECTION_MS,
  type CompleteStretchDto,
  type SaveConditionDto,
  type StartActivityDto,
} from './activity.dto.js';

export const ACTIVITY_TIMEOUT_MS = 15_000;
export const MEDITATION_SECONDS = 180;
const stretchSeconds = (2 * STRETCH_DIRECTION_MS) / 1_000;
const activityKinds = {
  focus: 'FOCUS',
  meditation: 'MEDITATION',
  'shoulder-cross-body': 'SHOULDER_CROSS_BODY',
} as const satisfies Record<StartActivityDto['kind'], ActivityKind>;

function sessionView(session: ActivitySession) {
  return {
    id: session.id,
    kind: (Object.keys(activityKinds) as StartActivityDto['kind'][]).find(
      (kind) => activityKinds[kind] === session.kind,
    ),
    status: session.status.toLowerCase(),
    startedAt: session.startedAt.toISOString(),
    durationSeconds: session.durationSeconds,
  };
}

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ActivityClock,
  ) {}

  private expired(now: Date) {
    return {
      OR: [
        { lastSeenAt: { lte: new Date(now.getTime() - ACTIVITY_TIMEOUT_MS) } },
        { recordDate: { not: new Date(koreanDay(now).recordDate) } },
      ],
    };
  }

  async today(userId: string) {
    const now = this.clock.now(),
      day = koreanDay(now);
    await this.prisma.client.activitySession.updateMany({
      where: { userId, status: 'RUNNING', ...this.expired(now) },
      data: { status: 'FAILED', endedAt: now },
    });
    const [condition, totals, active] = await Promise.all([
      this.prisma.client.conditionRecord.findUnique({
        where: { userId_recordDate: { userId, recordDate: new Date(day.recordDate) } },
      }),
      this.prisma.client.activitySession.groupBy({
        by: ['kind'],
        where: { userId, recordDate: new Date(day.recordDate), status: 'COMPLETED' },
        _count: { _all: true },
        _sum: { durationSeconds: true },
      }),
      this.prisma.client.activitySession.findFirst({ where: { userId, status: 'RUNNING' } }),
    ]);
    const total = (kind: ActivityKind) => {
      const value = totals.find((row) => row.kind === kind);
      return { count: value?._count._all ?? 0, seconds: value?._sum.durationSeconds ?? 0 };
    };
    return {
      ...day,
      condition: condition
        ? { score: condition.score, updatedAt: condition.updatedAt.toISOString() }
        : null,
      focus: total('FOCUS'),
      meditation: total('MEDITATION'),
      stretching: total('SHOULDER_CROSS_BODY'),
      activeSession: active ? sessionView(active) : null,
    };
  }

  async saveCondition(userId: string, input: SaveConditionDto) {
    const day = koreanDay(this.clock.now());
    if (input.recordDate !== day.recordDate)
      throw new ConflictException(
        '이전 날짜의 컨디션은 수정할 수 없어요. 오늘 날짜를 확인해 주세요.',
      );
    await this.prisma.client.conditionRecord.upsert({
      where: { userId_recordDate: { userId, recordDate: new Date(day.recordDate) } },
      create: { userId, recordDate: new Date(day.recordDate), score: input.score },
      update: { score: input.score },
    });
    return this.today(userId);
  }

  async start(userId: string, kind: StartActivityDto['kind']) {
    const now = this.clock.now(),
      day = koreanDay(now);
    const lock = createHash('sha256').update(`activity:${userId}`).digest().readBigInt64BE();
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lock}::bigint)::text`;
      await tx.activitySession.updateMany({
        where: { userId, status: 'RUNNING', ...this.expired(now) },
        data: { status: 'FAILED', endedAt: now },
      });
      if (await tx.activitySession.findFirst({ where: { userId, status: 'RUNNING' } }))
        throw new ConflictException(
          '이미 진행 중인 측정이 있어요. 기존 측정을 종료하거나 잠시 후 다시 시작해 주세요.',
        );
      const session = await tx.activitySession.create({
        data: {
          userId,
          recordDate: new Date(day.recordDate),
          kind: activityKinds[kind],
          startedAt: now,
          lastSeenAt: now,
        },
      });
      return sessionView(session);
    });
  }

  private async owned(userId: string, id: string) {
    const session = await this.prisma.client.activitySession.findFirst({ where: { id, userId } });
    if (!session) throw new NotFoundException();
    return session;
  }

  private async live(userId: string, id: string) {
    const session = await this.owned(userId, id),
      now = this.clock.now();
    if (
      session.status === 'RUNNING' &&
      (now.getTime() - session.lastSeenAt.getTime() >= ACTIVITY_TIMEOUT_MS ||
        session.recordDate.toISOString().slice(0, 10) !== koreanDay(now).recordDate)
    ) {
      await this.prisma.client.activitySession.updateMany({
        where: { id, userId, status: 'RUNNING' },
        data: { status: 'FAILED', endedAt: now },
      });
      throw new ConflictException('측정이 중단되었거나 날짜가 변경되어 실패 처리됐어요.');
    }
    return { session, now };
  }

  async heartbeat(userId: string, id: string) {
    const { session, now } = await this.live(userId, id);
    if (session.status !== 'RUNNING') throw new ConflictException('이미 종료된 측정이에요.');
    const changed = await this.prisma.client.activitySession.updateMany({
      where: {
        id,
        userId,
        status: 'RUNNING',
        lastSeenAt: { gt: new Date(now.getTime() - ACTIVITY_TIMEOUT_MS) },
      },
      data: { lastSeenAt: now },
    });
    if (changed.count !== 1) throw new ConflictException('이미 종료된 측정이에요.');
    return { status: 'running' };
  }

  async complete(userId: string, id: string, stretch?: CompleteStretchDto) {
    const { session, now } = await this.live(userId, id);
    const isStretch = session.kind === 'SHOULDER_CROSS_BODY';
    if (isStretch !== Boolean(stretch)) {
      throw new BadRequestException('측정 종류에 맞는 완료 요청이 필요해요.');
    }
    if (
      stretch &&
      (stretch.leftMs !== STRETCH_DIRECTION_MS || stretch.rightMs !== STRETCH_DIRECTION_MS)
    ) {
      throw new BadRequestException('양쪽 자세를 각각 10초씩 완료해 주세요.');
    }
    if (session.status === 'COMPLETED') return this.today(userId);
    if (session.status !== 'RUNNING')
      throw new ConflictException('실패한 측정은 완료할 수 없어요.');
    const seconds = Math.floor((now.getTime() - session.startedAt.getTime()) / 1_000);
    const requiredSeconds = isStretch
      ? stretchSeconds
      : session.kind === 'MEDITATION'
        ? MEDITATION_SECONDS
        : 1;
    if (seconds < requiredSeconds)
      throw new BadRequestException('아직 측정 시간이 충족되지 않았어요.');
    const changed = await this.prisma.client.activitySession.updateMany({
      where: {
        id,
        userId,
        status: 'RUNNING',
        lastSeenAt: { gt: new Date(now.getTime() - ACTIVITY_TIMEOUT_MS) },
      },
      data: {
        status: 'COMPLETED',
        endedAt: now,
        durationSeconds: session.kind === 'FOCUS' ? seconds : requiredSeconds,
      },
    });
    if (changed.count !== 1 && (await this.owned(userId, id)).status !== 'COMPLETED')
      throw new ConflictException('실패한 측정은 완료할 수 없어요.');
    return this.today(userId);
  }

  async fail(userId: string, id: string) {
    await this.owned(userId, id);
    await this.prisma.client.activitySession.updateMany({
      where: { id, userId, status: 'RUNNING' },
      data: { status: 'FAILED', endedAt: this.clock.now() },
    });
    return this.today(userId);
  }
}
