const HOURS_IN_DAY = 24;
const SECONDS_IN_HOUR = 3600;

type HourData = { id: string; hour: number; numTrades: number };

type HourDataStore<Data extends HourData> = {
  get: (id: string) => Promise<Data | undefined>;
  set: (hourData: Data) => void;
};

export const recordTradeInRollingDay = async <Data extends HourData>(
  store: HourDataStore<Data>,
  ownerId: string,
  timestamp: number,
  emptyHour: (id: string, hour: number) => Data,
  addTrade: (hourData: Data) => Data,
) => {
  const hour = Math.floor(timestamp / SECONDS_IN_HOUR);
  const hourDataId = (hourToLoad: number) => `${ownerId}_${hourToLoad}`;
  const [currentHour, ...previousHours] = await Promise.all(
    Array.from({ length: HOURS_IN_DAY }, (_, hoursAgo) => store.get(hourDataId(hour - hoursAgo))),
  );
  const updatedCurrentHour = addTrade(currentHour ?? emptyHour(hourDataId(hour), hour));
  store.set(updatedCurrentHour);
  return [updatedCurrentHour, ...previousHours.filter((hourData) => hourData !== undefined)];
};
