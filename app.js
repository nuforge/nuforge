// ============================================================
// 7. RESOLUTION EXPERIMENT
// ============================================================

for (const request of [
  Requests.SomethingAliceHolds,
  Requests.EverythingAliceHolds,
]) {
  const { result, trace } = resolveRequest(request, Rules, assertions);
  console.log(result);
  console.log(formatTrace(trace));
}
