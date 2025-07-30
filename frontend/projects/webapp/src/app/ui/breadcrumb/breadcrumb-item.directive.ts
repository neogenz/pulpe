import { Directive, inject, TemplateRef } from '@angular/core';

@Directive({
  selector: '[pulpeBreadcrumbItem]',
  standalone: true,
})
export class BreadcrumbItemDirective {
  public templateRef = inject(TemplateRef);
}
