import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";

const errors = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    console.error(error);
    throw error;
  }
});
export const startInstance = createStart(() => ({
  requestMiddleware: [
    errors,
    createCsrfMiddleware({ filter: (context) => context.handlerType === "serverFn" }),
  ],
}));
