import { describe, it, expect, beforeEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { form } from '@angular/forms/signals';
import { MatSnackBar } from '@angular/material/snack-bar';
import { type MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import type { Tag } from 'pulpe-shared';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { createMockTagStore } from '@app/testing/tag-store.mock';
import { setTestInput } from '@app/testing/signal-test-utils';
import { TagStore } from '@core/tag';
import { TagPicker } from './tag-picker';

function makeTag(id: string, name: string): Tag {
  return {
    id,
    userId: 'user-1',
    name,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('TagPicker', () => {
  let fixture: ComponentFixture<TagPicker>;
  let component: TagPicker;
  let tagStore: ReturnType<typeof createMockTagStore>;
  let model: ReturnType<typeof signal<{ tagIds: string[] }>>;

  function setup(tagIds: string[], tags: Tag[]): void {
    tagStore.setTags(tags);
    model = signal<{ tagIds: string[] }>({ tagIds });
    const testForm = TestBed.runInInjectionContext(() => form(model));
    fixture = TestBed.createComponent(TagPicker);
    component = fixture.componentInstance;
    setTestInput(component.control, testForm.tagIds);
    fixture.detectChanges();
  }

  beforeEach(() => {
    tagStore = createMockTagStore();
    TestBed.configureTestingModule({
      imports: [TagPicker],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        { provide: TagStore, useValue: tagStore },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    });
  });

  it('should render a chip for each selected tag id with its name', () => {
    setup(['tag-1'], [makeTag('tag-1', 'Courses')]);

    const chip = fixture.nativeElement.querySelector('mat-chip-row');
    expect(chip?.textContent).toContain('Courses');
  });

  it('should attach an existing tag when its option is selected', async () => {
    setup([], [makeTag('tag-1', 'Courses')]);

    await component['onOptionSelected']({
      option: { value: { type: 'existing', id: 'tag-1', name: 'Courses' } },
    } as MatAutocompleteSelectedEvent);

    expect(model().tagIds).toEqual(['tag-1']);
  });

  it('should create a tag and attach it when the create option is selected', async () => {
    setup([], []);
    const created = makeTag('tag-9', 'Santé');
    tagStore.addTag.mockResolvedValue(created);

    await component['onOptionSelected']({
      option: { value: { type: 'create', name: 'Santé' } },
    } as MatAutocompleteSelectedEvent);

    expect(tagStore.addTag).toHaveBeenCalledWith('Santé');
    expect(model().tagIds).toEqual(['tag-9']);
  });

  it('should offer a create suggestion for a query with no exact match', () => {
    setup([], [makeTag('tag-1', 'Courses')]);
    component['query'].set('Santé');

    const suggestions = component['suggestions']();

    expect(
      suggestions.some((s) => s.type === 'create' && s.name === 'Santé'),
    ).toBe(true);
  });

  it('should remove a tag when its chip is removed', () => {
    setup(
      ['tag-1', 'tag-2'],
      [makeTag('tag-1', 'Courses'), makeTag('tag-2', 'Loisirs')],
    );

    component['removeTag']('tag-1');

    expect(model().tagIds).toEqual(['tag-2']);
  });
});
