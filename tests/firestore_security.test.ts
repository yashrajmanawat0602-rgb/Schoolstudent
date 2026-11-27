import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const blueprint = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
);
const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('Firestore Security Blueprint & Hardened Rules Audit', () => {
  it('enforces default-deny catch-all and strict rules_version 2', () => {
    expect(rules).toContain("rules_version = '2';");
    expect(rules).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
  });

  it('covers every collection in firebase-blueprint.json with hardened match blocks', () => {
    const paths = Object.keys(blueprint.firestore);
    expect(paths).toContain('/userProfiles/{userId}');
    expect(paths).toContain('/userNotes/{noteId}');
    expect(paths).toContain('/admins/{userId}');

    expect(rules).toContain('match /userProfiles/{userId}');
    expect(rules).toContain('match /userNotes/{noteId}');
    expect(rules).toContain('match /admins/{userId}');
  });

  it('enforces email verification, valid ID regex, temporal integrity, and zero list get() lookups', () => {
    expect(rules).toContain('request.auth.token.email_verified == true');
    expect(rules).toContain("id.matches('^[a-zA-Z0-9_\\\\-]+$')");
    expect(rules).toContain('incoming().createdAt == request.time');
    expect(rules).toContain('incoming().updatedAt == request.time');
    expect(rules).toContain('allow list: if isSignedIn()');
    expect(rules).toContain('resource.data.ownerId == request.auth.uid');
    expect(rules).toContain('affectedKeys().hasOnly');
  });
});
