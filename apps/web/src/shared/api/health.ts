import { apiClient } from './instance';

interface HealthResponse {
  status: 'ok';
  service: 'commit-health-server';
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const { data } = await apiClient.get<HealthResponse>('health', { signal });

  if (data.status !== 'ok' || data.service !== 'commit-health-server') {
    throw new Error('Unexpected health response');
  }

  return data;
}
