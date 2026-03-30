import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../audit/audit.service';

export const AUDIT_ACTION_KEY = 'auditAction';
export const AUDIT_ENTITY_KEY = 'auditEntity';

export function AuditAction(action: string, entity: string) {
  return function (target: any, key: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(AUDIT_ACTION_KEY, action, descriptor.value);
    Reflect.defineMetadata(AUDIT_ENTITY_KEY, entity, descriptor.value);
    return descriptor;
  };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());
    const entity = this.reflector.get<string>(AUDIT_ENTITY_KEY, context.getHandler());

    if (!action || !entity) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap((response) => {
        if (user) {
          this.auditService
            .log({
              userId: user.id,
              userRole: user.role,
              action,
              targetEntity: entity,
              targetId: response?.id?.toString(),
              newValue: response,
            })
            .catch((err) => console.error('Audit log error:', err));
        }
      }),
    );
  }
}
