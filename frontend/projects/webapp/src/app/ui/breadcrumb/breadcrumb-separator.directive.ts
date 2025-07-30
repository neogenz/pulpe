import { Directive, inject, TemplateRef } from '@angular/core';

@Directive({
  selector: '[pulpeBreadcrumbSeparator]',
  standalone: true,
})
export class BreadcrumbSeparatorDirective {
  public templateRef = inject(TemplateRef);
}
