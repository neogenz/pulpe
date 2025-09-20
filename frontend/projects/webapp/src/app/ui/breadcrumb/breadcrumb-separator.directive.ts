import { Directive, inject, TemplateRef } from '@angular/core';

@Directive({
  selector: '[pulpeBreadcrumbSeparator]',
})
export class BreadcrumbSeparatorDirective {
  public templateRef = inject(TemplateRef);
}
