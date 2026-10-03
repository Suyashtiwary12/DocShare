import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
    (field: string | undefined, context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest<{ user: Record<string, unknown> }>();
        return field ? request.user?.[field] : request.user;
    },
);