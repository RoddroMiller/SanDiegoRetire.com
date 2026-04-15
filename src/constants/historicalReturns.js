// Historical Annual Returns by Asset Class (2000-2024)
// Sources: S&P 500 total return, Bloomberg Barclays US Aggregate Bond, 3-Month T-Bill
// Used for MWM Advanced Rebalancing Engine illustration

export const HISTORICAL_RETURNS = {
  2000: { equity: -9.10, bonds: 11.63, cash: 5.89 },
  2001: { equity: -11.89, bonds: 8.44, cash: 3.83 },
  2002: { equity: -22.10, bonds: 10.26, cash: 1.65 },
  2003: { equity: 28.68, bonds: 4.10, cash: 1.02 },
  2004: { equity: 10.88, bonds: 4.34, cash: 1.20 },
  2005: { equity: 4.91, bonds: 2.43, cash: 3.00 },
  2006: { equity: 15.79, bonds: 4.33, cash: 4.73 },
  2007: { equity: 5.49, bonds: 6.97, cash: 4.74 },
  2008: { equity: -37.00, bonds: 5.24, cash: 1.80 },
  2009: { equity: 26.46, bonds: 5.93, cash: 0.16 },
  2010: { equity: 15.06, bonds: 6.54, cash: 0.13 },
  2011: { equity: 2.11, bonds: 7.84, cash: 0.06 },
  2012: { equity: 16.00, bonds: 4.22, cash: 0.07 },
  2013: { equity: 32.39, bonds: -2.02, cash: 0.05 },
  2014: { equity: 13.69, bonds: 5.97, cash: 0.03 },
  2015: { equity: 1.38, bonds: 0.55, cash: 0.05 },
  2016: { equity: 11.96, bonds: 2.65, cash: 0.32 },
  2017: { equity: 21.83, bonds: 3.54, cash: 0.86 },
  2018: { equity: -4.38, bonds: 0.01, cash: 1.87 },
  2019: { equity: 31.49, bonds: 8.72, cash: 2.28 },
  2020: { equity: 18.40, bonds: 7.51, cash: 0.67 },
  2021: { equity: 28.71, bonds: -1.54, cash: 0.05 },
  2022: { equity: -18.11, bonds: -13.01, cash: 1.46 },
  2023: { equity: 26.29, bonds: 5.53, cash: 5.26 },
  2024: { equity: 25.02, bonds: 1.25, cash: 5.35 },
};

// Maps each bucket to a blend of asset classes
// B1 = 100% cash, B2 = 20% equity / 80% bonds, B3 = 60/40, B4 = 70% equity / 30% bonds, B5 = 100% equity
export const BUCKET_ASSET_BLEND = {
  b1: { equity: 0, bonds: 0, cash: 1.0 },
  b2: { equity: 0.20, bonds: 0.80, cash: 0 },
  b3: { equity: 0.60, bonds: 0.40, cash: 0 },
  b4: { equity: 0.70, bonds: 0.30, cash: 0 },
  b5: { equity: 1.0, bonds: 0, cash: 0 },
};

// Compute bucket return from historical year using asset blend
export const getBucketReturn = (bucket, year) => {
  const blend = BUCKET_ASSET_BLEND[bucket];
  const data = HISTORICAL_RETURNS[year];
  if (!blend || !data) return 0;
  return (blend.equity * data.equity + blend.bonds * data.bonds + blend.cash * data.cash) / 100;
};
