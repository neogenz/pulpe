import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';

export function provideAngularMaterial() {
  return {
    provide: MAT_ICON_DEFAULT_OPTIONS,
    useValue: {
      fontSet: 'material-symbols-outlined',
    },
  };
}