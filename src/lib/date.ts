function formatDateKey(date: Date, timeZone = "Asia/Shanghai") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const values = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return `${values.year}-${values.month}-${values.day}`;
}

export function getTodayDateKey(timeZone = "Asia/Shanghai") {
  return formatDateKey(new Date(), timeZone);
}

export function getDateKeyFromOffset(offsetDays: number, timeZone = "Asia/Shanghai") {
  const targetDate = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return formatDateKey(targetDate, timeZone);
}
