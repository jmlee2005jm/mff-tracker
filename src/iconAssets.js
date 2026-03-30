export const UPGRADE_ICON_BY_LEVEL = {
  '2티': 'https://thanosvibs.money/static/attributes/t2.png',
  '각초': 'https://thanosvibs.money/static/attributes/tp.png',
  '3티': 'https://thanosvibs.money/static/attributes/t3.png',
  '4티': 'https://thanosvibs.money/static/attributes/t4.png',
};

export const CTP_ICON_BY_TYPE = {
  통찰: 'https://thanosvibs.money/static/assets/items/ctp_insight.png',
  극복: 'https://thanosvibs.money/static/assets/items/ctp_conquest.png',
  탐욕: 'https://thanosvibs.money/static/assets/items/ctp_greed.png',
  해방: 'https://thanosvibs.money/static/assets/items/ctp_liberation.png',
  분노: 'https://thanosvibs.money/static/assets/items/ctp_rage.png',
  경쟁: 'https://thanosvibs.money/static/assets/items/ctp_competition.png',
  파괴: 'https://thanosvibs.money/static/assets/items/ctp_destruction.png',
  제련: 'https://thanosvibs.money/static/assets/items/ctp_refinement.png',
  권능: 'https://thanosvibs.money/static/assets/items/ctp_authority.png',
  심판: 'https://thanosvibs.money/static/assets/items/ctp_judgement.png',
  재생: 'https://thanosvibs.money/static/assets/items/ctp_regeneration.png',
  격동: 'https://thanosvibs.money/static/assets/items/ctp_energy.png',
  인내: 'https://thanosvibs.money/static/assets/items/ctp_patience.png',
  초월: 'https://thanosvibs.money/static/assets/items/ctp_transcendence.png',
};

export const DEFAULT_CTP_PREVIEW_ICON = 'https://thanosvibs.money/static/assets/items/6obelisk.png';

export const STATIC_ICON_URLS = [
  ...Object.values(UPGRADE_ICON_BY_LEVEL),
  ...Object.values(CTP_ICON_BY_TYPE),
  DEFAULT_CTP_PREVIEW_ICON,
];
