import { aiDestinationChecker } from '@/helpers/ai-destination-checker';
import { collectDestinationInfo } from '@/helpers/browser-render';
import { initDatabase } from '@repo/data-ops/database';
import { addEvalution } from '@repo/data-ops/queries/evaluationts';
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

export class DestinationEvaluationWorkflow extends WorkflowEntrypoint<Env, DestinationStatusEvaluationParams> {
	async run(event: Readonly<WorkflowEvent<DestinationStatusEvaluationParams>>, step: WorkflowStep) {
		initDatabase(this.env.DB);

		const collectionData = await step.do('Collect rendered destination page data', async () => {
			return collectDestinationInfo(this.env, event.payload.destinationUrl);
		});

		const aiStatus = await step.do(
			'Use AI to check the status of the page',
			{
				retries: {
					limit: 0,
					delay: 0,
				},
			},
			async () => {
				return await aiDestinationChecker(this.env, collectionData.bodyText);
			},
		);

		const evaluationId = await step.do('Save evaluation in database', async () => {
			return await addEvalution({
				linkId: event.payload.linkId,
				status: aiStatus.status,
				reason: aiStatus.statusReason,
				accountId: event.payload.accountId,
				destinationUrl: event.payload.destinationUrl,
			});
		});

		await step.do('Backup destintion HTML in R2', async () => {
			const accountId = event.payload.accountId;
			const r2PathHtml = `evaulations/${accountId}/html/${evaluationId}`;
			const r2PathBodyText = `evaulations/${accountId}/body-text/${evaluationId}`;
			const r2PathScreenshot = `evaluation/${accountId}/screenshots/${evaluationId}.png`;

			const screenshotBase64 = collectionData.screenshotDataUrl.replace(/^data:image\/png;base64,/, '');
			const screenshotBuffer = Buffer.from(screenshotBase64, 'base64');

			await this.env.BUCKET.put(r2PathHtml, collectionData.html);
			await this.env.BUCKET.put(r2PathBodyText, collectionData.bodyText);
			await this.env.BUCKET.put(r2PathScreenshot, screenshotBuffer);
		});

		console.log(collectionData);
	}
}
