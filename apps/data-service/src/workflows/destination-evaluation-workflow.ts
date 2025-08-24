import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

export class DestinationEvaluationWorkflow extends WorkflowEntrypoint<Env, unknown> {
	async run(event: Readonly<WorkflowEvent<unknown>>, step: WorkflowStep) {
		const collectionData = await step.do('Collect rendered destination page data', async () => {
			return {
				data: 'Hello World',
				payload: `Event: ${event.payload}`,
			};
		});
		console.log(collectionData);
	}
}
