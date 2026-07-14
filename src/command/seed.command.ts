// external imports
import { Command, CommandRunner } from 'nest-commander';
// internal imports
import appConfig from '../config/app.config';
import { StringHelper } from '../common/helper/string.helper';
import { UserRepository } from '../common/repository/user/user.repository';
import { PrismaService } from '../prisma/prisma.service';

@Command({ name: 'seed', description: 'prisma db seed' })
export class SeedCommand extends CommandRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userRepository: UserRepository,
  ) {
    super();
  }
  async run(passedParam: string[]): Promise<void> {
    await this.seed(passedParam);
  }

  async seed(param: string[]) {
    try {
      console.log(`Prisma Env: ${process.env.PRISMA_ENV}`);
      console.log('Seeding started...');

      // begin transaaction
      await this.prisma.$transaction(async ($tx) => {
        await this.roleSeed();
        await this.permissionSeed();
        await this.userSeed();
        await this.permissionRoleSeed();
        await this.subscriptionFeatureSeed();
      });

      console.log('Seeding done.');
    } catch (error) {
      throw error;
    }
  }

  //---- user section ----
  async userSeed() {
    const email = appConfig().defaultUser.system.email;
    let systemUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!systemUser) {
      systemUser = await this.userRepository.createSuAdminUser({
        username: appConfig().defaultUser.system.username,
        email: email,
        password: appConfig().defaultUser.system.password,
      });
    }

    await this.prisma.roleUser.createMany({
      data: [
        {
          user_id: systemUser.id,
          role_id: '1',
        },
      ],
      skipDuplicates: true,
    });
  }

  async permissionSeed() {
    let i = 0;
    const permissions = [];
    const permissionGroups = [
      // (system level )super admin level permission
      { title: 'system_tenant_management', subject: 'SystemTenant' },
      // end (system level )super admin level permission
      { title: 'user_management', subject: 'User' },
      { title: 'role_management', subject: 'Role' },
      // Project
      { title: 'Project', subject: 'Project' },
      // Task
      {
        title: 'Task',
        subject: 'Task',
        scope: ['read', 'create', 'update', 'show', 'delete', 'assign'],
      },
      // Comment
      { title: 'Comment', subject: 'Comment' },
    ];

    for (const permissionGroup of permissionGroups) {
      if (permissionGroup['scope']) {
        for (const permission of permissionGroup['scope']) {
          permissions.push({
            id: String(++i),
            title: permissionGroup.title + '_' + permission,
            action: StringHelper.cfirst(permission),
            subject: permissionGroup.subject,
          });
        }
      } else {
        for (const permission of [
          'read',
          'create',
          'update',
          'show',
          'delete',
        ]) {
          permissions.push({
            id: String(++i),
            title: permissionGroup.title + '_' + permission,
            action: StringHelper.cfirst(permission),
            subject: permissionGroup.subject,
          });
        }
      }
    }

    await this.prisma.permission.createMany({
      data: permissions,
      skipDuplicates: true,
    });
  }

  async permissionRoleSeed() {
    const all_permissions = await this.prisma.permission.findMany();
    const su_admin_permissions = all_permissions.filter(function (permission) {
      return permission.title.substring(0, 25) == 'system_tenant_management_';
    });
    // const su_admin_permissions = all_permissions;

    // -----su admin permission---
    const adminPermissionRoleArray = [];
    for (const su_admin_permission of su_admin_permissions) {
      adminPermissionRoleArray.push({
        role_id: '1',
        permission_id: su_admin_permission.id,
      });
    }
    await this.prisma.permissionRole.createMany({
      data: adminPermissionRoleArray,
      skipDuplicates: true,
    });
    // -----------

    // ---admin---
    const project_admin_permissions = all_permissions.filter(
      function (permission) {
        return permission.title.substring(0, 25) != 'system_tenant_management_';
      },
    );

    const projectAdminPermissionRoleArray = [];
    for (const admin_permission of project_admin_permissions) {
      projectAdminPermissionRoleArray.push({
        role_id: '2',
        permission_id: admin_permission.id,
      });
    }
    await this.prisma.permissionRole.createMany({
      data: projectAdminPermissionRoleArray,
      skipDuplicates: true,
    });
    // -----------

    // ---project manager---
    const project_manager_permissions = all_permissions.filter(
      function (permission) {
        return (
          permission.title == 'project_read' ||
          permission.title == 'project_show' ||
          permission.title == 'project_update' ||
          permission.title.substring(0, 4) == 'Task' ||
          permission.title.substring(0, 7) == 'Comment'
        );
      },
    );

    const projectManagerPermissionRoleArray = [];
    for (const project_manager_permission of project_manager_permissions) {
      projectManagerPermissionRoleArray.push({
        role_id: '3',
        permission_id: project_manager_permission.id,
      });
    }
    await this.prisma.permissionRole.createMany({
      data: projectManagerPermissionRoleArray,
      skipDuplicates: true,
    });
    // -----------

    // ---member---
    const member_permissions = all_permissions.filter(function (permission) {
      return (
        permission.title == 'project_read' ||
        permission.title == 'project_show' ||
        permission.title == 'task_read' ||
        permission.title == 'task_show' ||
        permission.title == 'task_update' ||
        permission.title.substring(0, 7) == 'comment'
      );
    });

    const memberPermissionRoleArray = [];
    for (const project_manager_permission of member_permissions) {
      memberPermissionRoleArray.push({
        role_id: '4',
        permission_id: project_manager_permission.id,
      });
    }
    await this.prisma.permissionRole.createMany({
      data: memberPermissionRoleArray,
      skipDuplicates: true,
    });
    // -----------

    // ---viewer---
    const viewer_permissions = all_permissions.filter(function (permission) {
      return (
        permission.title == 'project_read' ||
        permission.title == 'project_show' ||
        permission.title == 'task_read' ||
        permission.title == 'comment_read'
      );
    });

    const viewerPermissionRoleArray = [];
    for (const viewer_permission of viewer_permissions) {
      viewerPermissionRoleArray.push({
        role_id: '5',
        permission_id: viewer_permission.id,
      });
    }
    await this.prisma.permissionRole.createMany({
      data: viewerPermissionRoleArray,
      skipDuplicates: true,
    });
    // -----------
  }

  async roleSeed() {
    await this.prisma.role.createMany({
      data: [
        // system role
        {
          id: '1',
          title: 'Super Admin', // system admin, do not assign to a tenant/user
          name: 'su_admin',
        },
        // organization role
        {
          id: '2',
          title: 'Admin',
          name: 'admin',
        },
        {
          id: '3',
          title: 'Project Manager',
          name: 'project_manager',
        },
        {
          id: '4',
          title: 'Member',
          name: 'member',
        },
        {
          id: '5',
          title: 'Viewer',
          name: 'viewer',
        },
      ],
      skipDuplicates: true,
    });
  }

  async subscriptionFeatureSeed() {
    const features = [
      {
        key: 'stop_logs',
        name: 'Stop Logs',
        description: 'Create and manage stop logs.',
        type: 'LIMIT' as const,
        unit: 'logs',
        reset_period: 'MONTHLY' as const,
        sort_order: 10,
      },
      {
        key: 'claims',
        name: 'Claims',
        description: 'Create detention claim cases.',
        type: 'LIMIT' as const,
        unit: 'claims',
        reset_period: 'MONTHLY' as const,
        sort_order: 20,
      },
      {
        key: 'view_shipper_ratings',
        name: 'View Shipper Ratings',
        description: 'View shipper rating during stop log creation.',
        type: 'BOOLEAN' as const,
        reset_period: 'NEVER' as const,
        sort_order: 25,
      },
      {
        key: 'view_shipper_reviews',
        name: 'View Shipper Reviews',
        description: 'View detailed reviews and feedback for shippers.',
        type: 'BOOLEAN' as const,
        reset_period: 'NEVER' as const,
        sort_order: 26,
      },
      {
        key: 'weekly_reports',
        name: 'Weekly Reports',
        description: 'View weekly detention reports.',
        type: 'BOOLEAN' as const,
        reset_period: 'NEVER' as const,
        sort_order: 30,
      },
      {
        key: 'proof_package',
        name: 'Proof Package',
        description: 'Generate proof packages for claims.',
        type: 'BOOLEAN' as const,
        reset_period: 'NEVER' as const,
        sort_order: 40,
      },
    ];

    // Seed Features
    const featureMap = new Map<string, string>();
    for (const feature of features) {
      const dbFeature = await this.prisma.subscriptionFeature.upsert({
        where: { key: feature.key },
        update: {
          name: feature.name,
          description: feature.description,
          type: feature.type,
          unit: feature.unit,
          reset_period: feature.reset_period,
          sort_order: feature.sort_order,
        },
        create: {
          key: feature.key,
          name: feature.name,
          description: feature.description,
          type: feature.type,
          unit: feature.unit,
          reset_period: feature.reset_period,
          sort_order: feature.sort_order,
        },
      });
      featureMap.set(feature.key, dbFeature.id);
    }

    // Seed Plans
    const plans = [
      {
        name: 'Free Plan',
        description: 'Basic access for drivers.',
        price: 0,
        currency: 'USD',
        interval: 'MONTHLY' as const,
        status: 'ACTIVE' as const,
        sort_order: 10,
        features: [
          { key: 'stop_logs', enabled: true, limit_value: 5 },
          { key: 'claims', enabled: false, limit_value: 0 },
          { key: 'view_shipper_ratings', enabled: false },
          { key: 'view_shipper_reviews', enabled: false },
          { key: 'weekly_reports', enabled: false },
          { key: 'proof_package', enabled: false },
        ],
      },
      {
        name: 'Pro Plan',
        description: 'Perfect for active drivers.',
        price: 19.99,
        currency: 'USD',
        interval: 'MONTHLY' as const,
        status: 'ACTIVE' as const,
        sort_order: 20,
        features: [
          { key: 'stop_logs', enabled: true, limit_value: 100 },
          { key: 'claims', enabled: true, limit_value: 10 },
          { key: 'view_shipper_ratings', enabled: true },
          { key: 'view_shipper_reviews', enabled: true },
          { key: 'weekly_reports', enabled: true },
          { key: 'proof_package', enabled: true },
        ],
      },
      {
        name: 'Premium Plan',
        description: 'Unlimited access.',
        price: 49.99,
        currency: 'USD',
        interval: 'MONTHLY' as const,
        status: 'ACTIVE' as const,
        sort_order: 30,
        features: [
          { key: 'stop_logs', enabled: true, limit_value: null },
          { key: 'claims', enabled: true, limit_value: null },
          { key: 'view_shipper_ratings', enabled: true },
          { key: 'view_shipper_reviews', enabled: true },
          { key: 'weekly_reports', enabled: true },
          { key: 'proof_package', enabled: true },
        ],
      },
    ];

    for (const plan of plans) {
      const { features: planFeatures, ...planData } = plan;

      const existingPlan = await this.prisma.subscriptionPlan.findFirst({
        where: { name: planData.name },
      });

      let dbPlan;
      if (existingPlan) {
        dbPlan = await this.prisma.subscriptionPlan.update({
          where: { id: existingPlan.id },
          data: {
            name: planData.name,
            description: planData.description,
            price: planData.price,
            currency: planData.currency,
            interval: planData.interval,
            status: planData.status,
            sort_order: planData.sort_order,
          },
        });
      } else {
        dbPlan = await this.prisma.subscriptionPlan.create({
          data: {
            name: planData.name,
            description: planData.description,
            price: planData.price,
            currency: planData.currency,
            interval: planData.interval,
            status: planData.status,
            sort_order: planData.sort_order,
          },
        });
      }

      // Link features to the plan
      for (const pf of planFeatures) {
        const featureId = featureMap.get(pf.key);
        if (!featureId) continue;

        await this.prisma.subscriptionPlanFeature.upsert({
          where: {
            plan_id_feature_id: {
              plan_id: dbPlan.id,
              feature_id: featureId,
            },
          },
          update: {
            enabled: pf.enabled,
            limit_value: pf.limit_value !== undefined ? pf.limit_value : null,
          },
          create: {
            plan_id: dbPlan.id,
            feature_id: featureId,
            enabled: pf.enabled,
            limit_value: pf.limit_value !== undefined ? pf.limit_value : null,
          },
        });
      }
    }
  }
}
