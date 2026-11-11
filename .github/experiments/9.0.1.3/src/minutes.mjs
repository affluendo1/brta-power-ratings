export function minuteEntry(motion, result) {
  return {
    motion: motion.number,
    subject: motion.title,
    minutesReserved: motion.allocatedMinutes,
    disposition: result.decision,
  };
}
