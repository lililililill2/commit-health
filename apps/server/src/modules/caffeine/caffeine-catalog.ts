type CatalogRow = readonly [id: string, name: string, servingLabel: string, caffeineMg: number];

function products(brand: string, sourceUrl: string, rows: readonly CatalogRow[]) {
  return rows.map(([id, name, servingLabel, caffeineMg]) => ({
    id,
    brand,
    name,
    servingLabel,
    caffeineMg,
    sourceUrl,
  }));
}

const starbucks = 'https://www.starbucks.co.kr/menu';
const mega = 'https://www.mega-mgccoffee.com/menu/menu.php';
const megaCoffee = `${mega}?category=1&menu_category1=1&menu_category2=1`;
const redBull = 'https://www.redbull.com/kr-ko/energydrink/products';
const ediyaAmericano = `https://www.ediya.com/contents/drink.html?chked_val=12%2C&skeyword=${encodeURIComponent('아메리카노')}`;
const dongAPharm = 'https://www.dapharm.com/ko/brand/product';
const minimumCatalogCaffeineMg = 70;

// Korean menu values for the stated serving, checked 2026-11-23. Keep IDs stable across revisions.
export const caffeineCatalog = [
  ...products('스타벅스', `${starbucks}/drink_view.do?product_cd=110563`, [
    ['starbucks-americano-iced-tall', '카페 아메리카노', '아이스 · Tall 355 mL', 150],
  ]),
  ...products('스타벅스', `${starbucks}/drink_view.do?product_cd=9200000000616`, [
    ['starbucks-decaf-americano-iced-tall', '디카페인 카페 아메리카노', '아이스 · Tall 355 mL', 10],
  ]),
  ...products('스타벅스', `${starbucks}/drink_list.do`, [
    ['starbucks-latte-iced-tall', '카페 라떼', '아이스 · Tall 355 mL', 75],
    ['starbucks-latte-hot-tall', '카페 라떼', '핫 · Tall 355 mL', 75],
    ['starbucks-cold-brew-tall', '콜드 브루', '아이스 · Tall 355 mL', 155],
    [
      'starbucks-vanilla-cream-cold-brew-tall',
      '바닐라 크림 콜드 브루',
      '아이스 · Tall 355 mL',
      135,
    ],
    ['starbucks-dolce-cold-brew-tall', '돌체 콜드 브루', '아이스 · Tall 355 mL', 130],
    [
      'starbucks-grapefruit-honey-black-tea-iced-tall',
      '자몽 허니 블랙 티',
      '아이스 · Tall 355 mL',
      30,
    ],
    ['starbucks-green-tea-hot-tall', '제주 녹차', '핫 · Tall 355 mL', 16],
    ['starbucks-matcha-latte-iced-tall', '제주 말차 라떼', '아이스 · Tall 355 mL', 80],
  ]),
  ...products('스타벅스', `${starbucks}/drink_view.do?product_cd=9200000002496`, [
    ['starbucks-matcha-latte-hot-tall', '제주 말차 라떼', '핫 · Tall 355 mL', 80],
  ]),
  ...products('메가MGC커피', `${megaCoffee}&page=1`, [
    ['mega-americano-hot', '아메리카노', '핫 · 591 mL', 236],
    ['mega-big-americano-iced', '메가리카노', '아이스 · 946 mL', 354],
    ['mega-honey-americano-hot', '꿀아메리카노', '핫 · 591 mL', 236],
    ['mega-espresso-hot', '에스프레소', '핫 · 59 mL', 118],
  ]),
  ...products('메가MGC커피', `${megaCoffee}&page=2`, [
    ['mega-honey-americano-iced', '꿀아메리카노', '아이스 · 710 mL', 236],
    ['mega-latte-iced', '카페라떼', '아이스 · 591 mL', 236],
    ['mega-latte-hot', '카페라떼', '핫 · 591 mL', 236],
  ]),
  ...products('메가MGC커피', `${mega}?category=5&menu_category1=1&menu_category2=1&page=1`, [
    ['mega-decaf-americano-hot', '디카페인 아메리카노', '핫 · 591 mL', 7.8],
    ['mega-decaf-americano-iced', '디카페인 아메리카노', '아이스 · 710 mL', 7.8],
    ['mega-decaf-big-americano-iced', '디카페인 메가리카노', '아이스 · 946 mL', 11.7],
    ['mega-decaf-espresso-hot', '디카페인 에스프레소', '핫 · 59 mL', 3.9],
  ]),
  ...products('메가MGC커피', `${mega}?category=2&menu_category1=1&menu_category2=1&page=1`, [
    ['mega-peach-iced-tea', '복숭아아이스티', '아이스 · 710 mL', 24],
  ]),
  ...products('빽다방', 'https://paikdabang.com/menu/menu_coffee/', [
    ['paik-americano-iced', '아메리카노', '아이스 · 660 mL', 166],
    ['paik-americano-hot', '아메리카노', '핫 · 510 mL', 197],
    ['paik-decaf-americano-iced', '디카페인 아메리카노', '아이스 · 660 mL', 1.2],
    ['paik-decaf-americano-hot', '디카페인 아메리카노', '핫 · 510 mL', 1],
    ['paik-latte-iced', '카페라떼', '아이스 · 660 mL', 163],
    ['paik-latte-hot', '카페라떼', '핫 · 510 mL', 152],
    ['paik-decaf-latte-hot', '디카페인 카페라떼', '핫 · 510 mL', 0.8],
    ['paik-original-coffee-iced', '원조커피', '아이스 · 660 mL', 346],
    ['paik-original-coffee-hot', '원조커피', '핫 · 510 mL', 345],
    ['paik-extra-americano-iced', '빽사이즈 아메리카노', '아이스 · 990 mL', 293],
    ['paik-extra-latte-iced', '빽사이즈 카페라떼', '아이스 · 990 mL', 286],
    ['paik-extra-decaf-americano-iced', '디카페인 빽사이즈 아메리카노', '아이스 · 990 mL', 1.6],
    ['paik-peach-shot-iced-tea', '아이스티샷추가(아샷추)', '아이스 · 660 mL', 100],
  ]),
  ...products('빽다방', 'https://paikdabang.com/menu/menu_drink/', [
    ['paik-peach-iced-tea', '복숭아 아이스티', '아이스 · 660 mL', 20.2],
    ['paik-peach-mango-iced-tea', '아망추', '아이스 · 660 mL', 15],
  ]),
  ...products('이디야', ediyaAmericano, [
    ['ediya-americano-hot-l', '카페 아메리카노', '핫 · L 520 mL', 202],
    ['ediya-americano-hot-ex', '카페 아메리카노', '핫 · EX 650 mL', 303],
    ['ediya-hazelnut-americano-hot-l', '헤이즐넛 아메리카노', '핫 · L 520 mL', 202],
    ['ediya-hazelnut-americano-hot-ex', '헤이즐넛 아메리카노', '핫 · EX 650 mL', 303],
    ['ediya-hazelnut-americano-iced-l', '헤이즐넛 아메리카노', '아이스 · L 520 mL', 202],
    ['ediya-hazelnut-americano-iced-ex', '헤이즐넛 아메리카노', '아이스 · EX 670 mL', 303],
    ['ediya-honey-white-americano-iced-l', '꿀화이트 아메리카노', '아이스 · L 520 mL', 202],
    ['ediya-honey-white-americano-iced-ex', '꿀화이트 아메리카노', '아이스 · EX 670 mL', 303],
  ]),
  ...products('핫식스', 'https://mmall.lottechilsung.co.kr/product-detail?productNo=124102404', [
    ['hot6-original-250', '오리지널', '1캔 · 250 mL', 60],
    ['hot6-original-355', '오리지널', '1캔 · 355 mL', 86],
  ]),
  ...products('핫식스', 'https://m.gsshop.com/prd/prd.gs?prdid=1034236567', [
    ['hot6-zero-250', '제로', '1캔 · 250 mL', 70],
  ]),
  ...products('핫식스', 'https://m.gsshop.com/prd/prd.gs?prdid=1051941219', [
    ['hot6-the-king-power-355', '더킹 파워', '1캔 · 355 mL', 100],
    ['hot6-the-king-force-355', '더킹 포스', '1캔 · 355 mL', 100],
    ['hot6-the-king-rush-355', '더킹 러쉬', '1캔 · 355 mL', 100],
    ['hot6-the-king-zero-355', '더킹 제로', '1캔 · 355 mL', 100],
    ['hot6-the-king-appleholic-355', '더킹 애플홀릭', '1캔 · 355 mL', 100],
    ['hot6-the-king-crush-peach-355', '더킹 크러쉬피치', '1캔 · 355 mL', 100],
    ['hot6-the-king-purple-grape-355', '더킹 퍼플그레이프', '1캔 · 355 mL', 100],
    ['hot6-the-king-frozen-blue-zero-355', '더킹 프로즌 블루 제로', '1캔 · 355 mL', 100],
  ]),
  ...products('핫식스', 'https://mmall.lottechilsung.co.kr/product-detail?productNo=133293348', [
    ['hot6-glow-apple-pomelo-355', '글로우 애플&포멜로', '1캔 · 355 mL', 80],
    ['hot6-glow-peach-apricot-355', '글로우 피치&살구', '1캔 · 355 mL', 80],
  ]),
  ...products('몬스터 에너지', 'https://www.ssg.com/item/itemView.ssg?itemId=1000015571665', [
    ['monster-original-355', '오리지널', '1캔 · 355 mL', 100],
  ]),
  ...products('몬스터 에너지', 'https://m.ssg.com/item/itemView.ssg?itemId=1000017796903', [
    ['monster-ultra-355', '울트라', '1캔 · 355 mL', 100],
  ]),
  ...products('몬스터 에너지', 'https://m.ssg.com/item/itemView.ssg?itemId=1000055762603', [
    ['monster-ultra-citra-355', '울트라 시트라', '1캔 · 355 mL', 100],
  ]),
  ...products('몬스터 에너지', 'https://emart.ssg.com/item/itemView.ssg?itemId=1000679802587', [
    ['monster-mango-loco-355', '망고 로코', '1캔 · 355 mL', 100],
  ]),
  ...products(
    '몬스터 에너지',
    'https://www.lyreco.com/webshop/KOKR/몬스터-에너지-드링크-파이프라인-펀치-355ml-x-24캔-product-000000000014370582.html',
    [['monster-pipeline-punch-355', '파이프라인 펀치', '1캔 · 355 mL', 100]],
  ),
  ...products('동아제약', `${dongAPharm}/BCS01`, [
    ['eolbaksa-original-355', '얼박사', '1캔 · 355 mL', 100],
  ]),
  ...products('동아제약', `${dongAPharm}/BCD02`, [
    ['eolbaksa-zero-355', '얼박사 제로', '1캔 · 355 mL', 100],
  ]),
  ...products('레드불', `${redBull}/red-bull-energy-drink`, [
    ['red-bull-original-250', '에너지 드링크', '1캔 · 250 mL', 62.5],
  ]),
  ...products('레드불', `${redBull}/red-bull-sugarfree`, [
    ['red-bull-sugarfree-250', '슈가프리', '1캔 · 250 mL', 62.5],
  ]),
  ...products('레드불', `${redBull}/red-bull-green-edition`, [
    ['red-bull-green-250', '그린 에디션', '1캔 · 250 mL', 62.5],
  ]),
  ...products('레드불', `${redBull}/red-bull-purple-edition`, [
    ['red-bull-purple-250', '퍼플 에디션', '1캔 · 250 mL', 62.5],
  ]),
  ...products('레드불', `${redBull}/red-bull-pink-edition`, [
    ['red-bull-pink-250', '핑크 에디션', '1캔 · 250 mL', 62.5],
  ]),
  ...products('코카콜라', 'https://www.coca-cola.com/kr/ko/brands/coca-cola/products', [
    ['coca-cola-zero-zero-350', '제로제로', '1캔 · 350 mL', 0],
  ]),
].filter(({ caffeineMg }) => caffeineMg >= minimumCatalogCaffeineMg);
