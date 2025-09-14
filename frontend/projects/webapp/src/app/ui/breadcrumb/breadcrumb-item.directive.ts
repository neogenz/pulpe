import { Directive, inject, TemplateRef } from '@angular/core';

@Directive({
  selector: '[pulpeBreadcrumbItem]',
})
export class BreadcrumbItemDirective {
  public templateRef = inject(TemplateRef);
}
