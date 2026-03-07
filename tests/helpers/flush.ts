export async function flushMicrotasks(cycles = 5): Promise<void> {
	// Entry points bootstrap through fire-and-forget async calls, so tests need a deterministic microtask drain.
	for (let index = 0; index < cycles; index += 1) {
		await new Promise<void>((resolve) => {
			queueMicrotask(resolve);
		});
	}
}
