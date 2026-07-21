import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach } from 'vitest';

import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import { TagIndicator } from './tag-indicator';

describe('TagIndicator', () => {
  let fixture: ComponentFixture<TagIndicator>;
  let component: TagIndicator;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagIndicator],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TagIndicator);
    component = fixture.componentInstance;
  });

  it('should not render anything when there are no tags', () => {
    setTestInput(component.tagNames, []);
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon).toBeNull();
  });

  it('should render the tag glyph and the tag count when tags are present', () => {
    setTestInput(component.tagNames, ['Courses', 'Loisirs', 'Voyage']);
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon?.textContent?.trim()).toBe('sell');

    const pill = fixture.nativeElement.querySelector('span[aria-label]');
    expect(pill?.textContent).toContain('3');
  });

  it('should expose the tag names as a newline-joined tooltip', () => {
    setTestInput(component.tagNames, ['Courses', 'Loisirs']);
    fixture.detectChanges();

    expect(component['tooltip']()).toBe('Courses\nLoisirs');
  });

  it('should expose the tooltip content to keyboard users', () => {
    setTestInput(component.tagNames, ['Courses', 'Loisirs']);
    fixture.detectChanges();

    const pill: HTMLSpanElement | null =
      fixture.nativeElement.querySelector('span[aria-label]');
    expect(pill?.getAttribute('role')).toBe('note');
    expect(pill?.getAttribute('tabindex')).toBe('0');
    expect(pill?.getAttribute('aria-label')).toContain('Courses');
    expect(pill?.getAttribute('aria-label')).toContain('Loisirs');
  });
});
