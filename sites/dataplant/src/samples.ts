// Built-in sample datasets so first-time visitors see the magic in one click.

export const SAMPLE_JSON = JSON.stringify(
  {
    mission: 'Kepler-442 survey',
    launched: '2031-04-17',
    operational: true,
    crew: [
      { name: 'R. Okafor', role: 'commander', hours: 4210 },
      { name: 'M. Lindqvist', role: 'pilot', hours: 3180 },
      { name: 'T. Ishikawa', role: 'science', hours: 2895 },
    ],
    instruments: {
      spectrometer: { band: 'IR', resolution: 0.42, active: true },
      magnetometer: { range_nt: 65000, active: true },
      dust_collector: { samples: 118, sealed: false },
    },
    telemetry: {
      distance_au: 1.62,
      velocity_kms: 26.4,
      fuel_kg: 1180.5,
      solar_w: 9400,
      packets: [911, 907, 913, 912, 909, 915, 910, 908],
    },
    anomalies: [
      { sol: 211, type: 'radiation spike', severity: 3 },
      { sol: 389, type: 'gyro drift', severity: 1 },
    ],
  },
  null,
  2,
);

export const SAMPLE_CSV = `region,month,revenue,units,returning,satisfaction
North,2026-01,48210.55,321,0.62,4.4
North,2026-02,51992.10,344,0.64,4.5
North,2026-03,60104.80,401,0.66,4.4
South,2026-01,38855.20,270,0.55,4.1
South,2026-02,41230.00,288,0.57,4.2
South,2026-03,45781.65,317,0.59,4.3
East,2026-01,29340.75,198,0.48,3.9
East,2026-02,33410.40,225,0.51,4.0
East,2026-03,36125.90,242,0.54,4.1
West,2026-01,55670.30,377,0.68,4.6
West,2026-02,58991.45,395,0.69,4.7
West,2026-03,64220.10,428,0.71,4.7`;

export const SAMPLE_TEXT = `Do not go gentle into that good night,
Old age should burn and rave at close of day;
Rage, rage against the dying of the light.

Though wise men at their end know dark is right,
Because their words had forked no lightning they
Do not go gentle into that good night.

Good men, the last wave by, crying how bright
Their frail deeds might have danced in a green bay,
Rage, rage against the dying of the light.`;

export const SAMPLES: Record<string, string> = {
  json: SAMPLE_JSON,
  csv: SAMPLE_CSV,
  text: SAMPLE_TEXT,
};
