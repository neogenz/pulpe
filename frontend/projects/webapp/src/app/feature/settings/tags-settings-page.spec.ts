import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  provideZonelessChangeDetection,
  signal,
  type WritableSignal,
} from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { By } from '@angular/platform-browser';
import { describe, expect, it, vi } from 'vitest';
import { type Tag } from 'pulpe-shared';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { TagStore } from '@core/tag';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
import TagsSettingsPage from './tags-settings-page';

@Component({
  selector: 'pulpe-base-loading',
  template: '<div [attr.data-testid]="testId()"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubBaseLoading {
  readonly message = input('');
  readonly size = input('medium');
  readonly testId = input('loading-container');
}

@Component({
  selector: 'pulpe-state-card',
  template: '<div [attr.data-testid]="testId()"></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubStateCard {
  readonly variant = input('error');
  readonly title = input('');
  readonly message = input('');
  readonly actionLabel = input<string | null>(null);
  readonly testId = input('state-card');
  readonly action = output<void>();
}

type ResourceStatus = 'loading' | 'error' | 'resolved';

interface MockTagsResource {
  value: WritableSignal<Tag[]>;
  status: WritableSignal<ResourceStatus>;
  error: WritableSignal<unknown>;
  reload: ReturnType<typeof vi.fn>;
}

const tags: Tag[] = [
  {
    id: 'tag-1',
    userId: 'user-1',
    name: 'Assurance',
    createdAt: '2026-07-15T18:00:00.000Z',
    updatedAt: '2026-07-15T18:00:00.000Z',
  },
  {
    id: 'tag-2',
    userId: 'user-1',
    name: 'Bureau',
    createdAt: '2026-07-15T18:00:00.000Z',
    updatedAt: '2026-07-15T18:00:00.000Z',
  },
];

describe('TagsSettingsPage', () => {
  async function render(
    status: ResourceStatus,
    value: Tag[] = [],
  ): Promise<{
    fixture: ComponentFixture<TagsSettingsPage>;
    resource: MockTagsResource;
  }> {
    const resource: MockTagsResource = {
      value: signal(value),
      status: signal(status),
      error: signal(status === 'error' ? new Error('network') : undefined),
      reload: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TagsSettingsPage],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        { provide: TagStore, useValue: { tags: resource } },
      ],
    })
      .overrideComponent(TagsSettingsPage, {
        remove: { imports: [BaseLoading, StateCard] },
        add: { imports: [StubBaseLoading, StubStateCard] },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(TagsSettingsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, resource };
  }

  it('shows a distinct loading state', async () => {
    const { fixture } = await render('loading');

    expect(
      fixture.debugElement.query(By.directive(StubBaseLoading)),
    ).toBeTruthy();
  });

  it('shows a recoverable error state', async () => {
    const { fixture, resource } = await render('error');
    const error = fixture.debugElement.query(By.directive(StubStateCard));

    expect(error).toBeTruthy();

    error.triggerEventHandler('action');

    expect(resource.reload).toHaveBeenCalledOnce();
  });

  it('shows a distinct empty state without mutation controls', async () => {
    const { fixture } = await render('resolved');

    expect(
      fixture.debugElement.query(By.directive(StubStateCard)),
    ).toBeTruthy();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('renders every backend tag and their count without mutation controls', async () => {
    const { fixture } = await render('resolved', tags);
    const rows = fixture.nativeElement.querySelectorAll(
      '[data-testid="tag-row"]',
    ) as NodeListOf<HTMLElement>;

    expect(rows).toHaveLength(2);
    expect(Array.from(rows, (row) => row.textContent?.trim())).toEqual([
      'sell Assurance',
      'sell Bureau',
    ]);
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="tag-counter"]')
        .textContent.trim(),
    ).toBe('2 tags personnels');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
