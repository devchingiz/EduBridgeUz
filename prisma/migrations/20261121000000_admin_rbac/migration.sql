-- Extend the existing role model with dedicated administration roles. Existing
-- STUDENT, REVIEWER, and ADMIN rows are untouched.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN' AFTER 'ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CONTENT_MANAGER' AFTER 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'UNIVERSITY_MANAGER' AFTER 'CONTENT_MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SCHOLARSHIP_MANAGER' AFTER 'UNIVERSITY_MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPPORT_MANAGER' AFTER 'SCHOLARSHIP_MANAGER';

-- Administrative capabilities. Role defaults live in application code; these
-- rows are explicit per-user grants created by a Super Admin.
CREATE TYPE "AdminPermission" AS ENUM (
    'ADMIN_ACCESS',
    'USERS_READ',
    'USERS_MANAGE',
    'CONTENT_READ',
    'CONTENT_MANAGE',
    'MEDIA_READ',
    'MEDIA_MANAGE',
    'UNIVERSITIES_READ',
    'UNIVERSITIES_MANAGE',
    'SCHOLARSHIPS_READ',
    'SCHOLARSHIPS_MANAGE',
    'APPLICATIONS_READ',
    'APPLICATIONS_REVIEW',
    'AI_READ',
    'AI_MANAGE',
    'NOTIFICATIONS_SEND',
    'AUDIT_READ',
    'SETTINGS_READ',
    'SETTINGS_MANAGE'
);

CREATE TABLE "AdminPermissionGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "AdminPermission" NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPermissionGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminPermissionGrant_userId_permission_key" ON "AdminPermissionGrant"("userId", "permission");
CREATE INDEX "AdminPermissionGrant_userId_idx" ON "AdminPermissionGrant"("userId");

ALTER TABLE "AdminPermissionGrant" ADD CONSTRAINT "AdminPermissionGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminPermissionGrant" ADD CONSTRAINT "AdminPermissionGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
