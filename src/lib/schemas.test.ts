import { describe, expect, it } from 'vitest';
import { milestoneSchema, projectSchema, roleSchema, skillGroupSchema } from './schemas';

const achievement = { id: 'a1', month: '2025-08', text: 'Cut load time 30x.' };
const role = {
  title: 'Software Engineer',
  org: 'Acme',
  start: '2025-07',
  end: 'present',
  kind: 'work',
  achievements: [achievement],
};
const project = {
  name: 'NexusBus',
  order: 1,
  month: '2025-08',
  result: 'Runs the gateway at work.',
  repo: 'https://github.com/Jonathan0823/nexusbus',
  tags: ['Go'],
  visual: { kind: 'diagram', label: 'Modbus to MQTT' },
};
const milestone = {
  date: '2025-08',
  label: 'Work',
  title: 'One gateway',
  tags: ['Go'],
};

describe('roleSchema', () => {
  it('accepts a role with achievements', () => {
    expect(roleSchema.safeParse(role).success).toBe(true);
  });
  it('accepts an end date instead of present', () => {
    expect(roleSchema.safeParse({ ...role, end: '2025-12' }).success).toBe(true);
  });
  it('rejects an achievement with empty text', () => {
    const r = roleSchema.safeParse({ ...role, achievements: [{ ...achievement, text: ' ' }] });
    expect(r.success).toBe(false);
  });
  it('rejects a malformed month', () => {
    expect(roleSchema.safeParse({ ...role, start: '2025-13' }).success).toBe(false);
  });
  it('rejects bracket placeholder text', () => {
    const r = roleSchema.safeParse({ ...role, achievements: [{ ...achievement, text: '[todo]' }] });
    expect(r.success).toBe(false);
  });
  it('rejects the word placeholder in any case', () => {
    expect(roleSchema.safeParse({ ...role, org: 'Placeholder Inc' }).success).toBe(false);
  });
});

describe('projectSchema', () => {
  it('accepts a complete project', () => {
    expect(projectSchema.safeParse(project).success).toBe(true);
  });
  it('allows a missing result but not an empty one', () => {
    const { result: _r, ...rest } = project;
    expect(projectSchema.safeParse(rest).success).toBe(true);
    expect(projectSchema.safeParse({ ...project, result: '' }).success).toBe(false);
  });
  it('accepts a visual with a src and rejects an unknown kind', () => {
    expect(projectSchema.safeParse({ ...project, visual: { kind: 'photo', label: 'x', src: '/a.png' } }).success).toBe(
      true,
    );
    expect(projectSchema.safeParse({ ...project, visual: { kind: 'gif', label: 'x' } }).success).toBe(false);
  });
});

describe('achievement story', () => {
  it('accepts paragraphs and rejects an empty list', () => {
    const withStory = (story: string[]) => ({ ...role, achievements: [{ ...achievement, story }] });
    expect(roleSchema.safeParse(withStory(['One.', 'Two.'])).success).toBe(true);
    expect(roleSchema.safeParse(withStory([])).success).toBe(false);
  });
});

describe('milestoneSchema', () => {
  it('accepts a milestone with a link and refs', () => {
    const r = milestoneSchema.safeParse({
      ...milestone,
      link: { href: 'https://github.com/Jonathan0823/nexusbus', text: 'Code on GitHub' },
      refs: [{ kind: 'project', id: 'nexusbus' }],
    });
    expect(r.success).toBe(true);
  });
  it('rejects a bad date', () => {
    expect(milestoneSchema.safeParse({ ...milestone, date: '2025' }).success).toBe(false);
  });
});

describe('skillGroupSchema', () => {
  it('requires at least one item', () => {
    expect(skillGroupSchema.safeParse({ group: 'Languages', items: [] }).success).toBe(false);
    expect(skillGroupSchema.safeParse({ group: 'Languages', items: [{ name: 'Go', icon: 'go' }] }).success).toBe(true);
  });
  it('needs exactly one way to draw each skill', () => {
    const parse = (item: object) => skillGroupSchema.safeParse({ group: 'Data', items: [item] }).success;
    expect(parse({ name: 'Go' })).toBe(false);
    expect(parse({ name: 'Go', icon: 'go', mono: 'GO' })).toBe(false);
    expect(parse({ name: 'Modbus', mono: 'MB' })).toBe(true);
    expect(parse({ name: 'Pi agent', art: 'pi' })).toBe(true);
    expect(parse({ name: 'Pi agent', art: 'nope' })).toBe(false);
  });
});
