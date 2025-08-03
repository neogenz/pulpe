import { describe, it, expect } from 'bun:test';
import { TemplateInfo } from '../../domain/value-objects/template-info.value-object';

describe('TemplateInfo Value Object', () => {
  describe('create', () => {
    it('should create a valid template info', () => {
      const result = TemplateInfo.create({
        name: 'My Budget Template',
        description: 'A description',
        isDefault: false,
      });

      expect(result.isSuccess).toBe(true);
      const info = result.getValue();
      expect(info.name).toBe('My Budget Template');
      expect(info.description).toBe('A description');
      expect(info.isDefault).toBe(false);
    });

    it('should create template info without description', () => {
      const result = TemplateInfo.create({
        name: 'My Budget Template',
        description: null,
        isDefault: true,
      });

      expect(result.isSuccess).toBe(true);
      const info = result.getValue();
      expect(info.description).toBeNull();
      expect(info.isDefault).toBe(true);
    });

    it('should fail with empty name', () => {
      const result = TemplateInfo.create({
        name: '',
        description: null,
        isDefault: false,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_TEMPLATE_INFO');
    });

    it('should fail with whitespace-only name', () => {
      const result = TemplateInfo.create({
        name: '   ',
        description: null,
        isDefault: false,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_TEMPLATE_INFO');
    });

    it('should fail with name too long', () => {
      const longName = 'a'.repeat(101);
      const result = TemplateInfo.create({
        name: longName,
        description: null,
        isDefault: false,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_TEMPLATE_INFO');
    });

    it('should fail with description too long', () => {
      const longDescription = 'a'.repeat(501);
      const result = TemplateInfo.create({
        name: 'Valid Name',
        description: longDescription,
        isDefault: false,
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_TEMPLATE_INFO');
    });
  });

  describe('setAsDefault', () => {
    it('should set template as default', () => {
      const result = TemplateInfo.create({
        name: 'My Template',
        description: null,
        isDefault: false,
      });

      const info = result.getValue();
      const defaultInfo = info.setAsDefault();

      expect(defaultInfo.isDefault).toBe(true);
      expect(defaultInfo.name).toBe(info.name);
    });
  });

  describe('unsetAsDefault', () => {
    it('should unset template as default', () => {
      const result = TemplateInfo.create({
        name: 'My Template',
        description: null,
        isDefault: true,
      });

      const info = result.getValue();
      const nonDefaultInfo = info.unsetAsDefault();

      expect(nonDefaultInfo.isDefault).toBe(false);
      expect(nonDefaultInfo.name).toBe(info.name);
    });
  });

  describe('update', () => {
    it('should update name only', () => {
      const original = TemplateInfo.create({
        name: 'Original',
        description: 'Original description',
        isDefault: true,
      }).getValue();

      const result = original.update({ name: 'Updated' });

      expect(result.isSuccess).toBe(true);
      const updated = result.getValue();
      expect(updated.name).toBe('Updated');
      expect(updated.description).toBe('Original description');
      expect(updated.isDefault).toBe(true);
    });

    it('should update description to null', () => {
      const original = TemplateInfo.create({
        name: 'Template',
        description: 'Has description',
        isDefault: false,
      }).getValue();

      const result = original.update({ description: null });

      expect(result.isSuccess).toBe(true);
      const updated = result.getValue();
      expect(updated.description).toBeNull();
    });

    it('should update all fields', () => {
      const original = TemplateInfo.create({
        name: 'Original',
        description: 'Original desc',
        isDefault: false,
      }).getValue();

      const result = original.update({
        name: 'New Name',
        description: 'New description',
        isDefault: true,
      });

      expect(result.isSuccess).toBe(true);
      const updated = result.getValue();
      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('New description');
      expect(updated.isDefault).toBe(true);
    });

    it('should fail update with invalid name', () => {
      const original = TemplateInfo.create({
        name: 'Valid',
        description: null,
        isDefault: false,
      }).getValue();

      const result = original.update({ name: '' });

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('INVALID_TEMPLATE_INFO');
    });
  });

  describe('equals', () => {
    it('should return true for equal template infos', () => {
      const info1 = TemplateInfo.create({
        name: 'Same Name',
        description: 'Same description',
        isDefault: true,
      }).getValue();

      const info2 = TemplateInfo.create({
        name: 'Same Name',
        description: 'Same description',
        isDefault: true,
      }).getValue();

      expect(info1.equals(info2)).toBe(true);
    });

    it('should return false for different names', () => {
      const info1 = TemplateInfo.create({
        name: 'Name 1',
        description: null,
        isDefault: false,
      }).getValue();

      const info2 = TemplateInfo.create({
        name: 'Name 2',
        description: null,
        isDefault: false,
      }).getValue();

      expect(info1.equals(info2)).toBe(false);
    });

    it('should return false for different default status', () => {
      const info1 = TemplateInfo.create({
        name: 'Same Name',
        description: null,
        isDefault: true,
      }).getValue();

      const info2 = TemplateInfo.create({
        name: 'Same Name',
        description: null,
        isDefault: false,
      }).getValue();

      expect(info1.equals(info2)).toBe(false);
    });
  });
});
