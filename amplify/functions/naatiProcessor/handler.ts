export const handler = async (
    event: unknown,
    context: { awsRequestId: string },
): Promise<{ statusCode: number; body: string }> => {
    console.info('naatiProcessor', {
        requestId: context.awsRequestId,
        event: JSON.stringify(event),
    });

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'naatiProcessor placeholder — implement pipeline here',
        }),
    };
};
