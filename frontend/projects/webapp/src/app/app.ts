import { Component } from '@angular/core';
import { MainLayoutComponent } from './layout/main-layout';

@Component({
  selector: 'pulpe-root',
  imports: [MainLayoutComponent],
  template: ` <pulpe-main-layout /> `,
})
export class App {}
