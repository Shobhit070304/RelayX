import { Job } from "../../models/job.types";

type JobHandler = (job: Job) => Promise<void>;

// Per-handler payload schema: each entry defines required fields and their expected types.
// Add a new entry here whenever a new job type is registered.
const payloadSchema: Record<string, Record<string, string>> = {
    send_email:   { to: 'string' },
    resize_image: { url: 'string' },
};

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const handlers: Record<string, JobHandler> = {
    send_email: async (job) => {
        if (job.payload.simulateFailure) {
            throw new Error('Simulated email provider outage');
        }
        console.log(`Sending email to ${job.payload.to}...`);
        await sleep(1000); // simulate network latency to an email provider
        console.log(`Email sent for job ${job.id}`);
    },

    resize_image: async (job) => {
        if (job.payload.simulateFailure) {
            throw new Error('Simulated resize failure');
        }
        console.log(`Resizing image ${job.payload.url}...`);
        await sleep(1500); // simulate CPU-bound work
        console.log(`Image resized for job ${job.id}`);
    },
};

export function getHandler(type: string): JobHandler | undefined {
    return handlers[type];
}

export function validatePayload(type: string, payload: Record<string, unknown>): string | null {
    const schema = payloadSchema[type];
    if (!schema) return null; // no schema defined for this type, skip validation

    for (const [field, expectedType] of Object.entries(schema)) {
        if (payload[field] === undefined || payload[field] === null) {
            return `payload.${field} is required for job type "${type}"`;
        }
        if (typeof payload[field] !== expectedType) {
            return `payload.${field} must be a ${expectedType} for job type "${type}"`;
        }
    }
    return null;
}