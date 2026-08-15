// external imports
import { Command, CommandRunner } from 'nest-commander';
// internal imports
import appConfig from '../config/app.config';
import { StringHelper } from '../common/helper/string.helper';
import { UserRepository } from '../common/repository/user/user.repository';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

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

      await this.prisma.$transaction(async ($tx) => {
        await this.roleSeed();
        await this.permissionSeed();
        await this.userSeed();
        await this.permissionRoleSeed();
        await this.subscriptionFeatureSeed();
        await this.locationSeed();
        await this.shipperFacilitySeed();
        await this.stopLogSeed();
        await this.claimSeed();
        await this.attachmentSeed();
        await this.shipperFacilityRatingSeed();
        await this.notificationSeed();
        await this.settingSeed();
        await this.userSettingSeed();
        await this.contactSeed();
        await this.paymentTransactionSeed();
        await this.userSubscriptionSeed();
        await this.featureUsageSeed();
        await this.claimEventSeed();
      });

      console.log('Seeding done.');
    } catch (error) {
      console.error('Seeding failed:', error);
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

    // Create additional users
    const users = [
      {
        username: 'john_doe',
        email: 'john@example.com',
        name: 'John Doe',
        type: 'user',
        status: 1,
      },
      {
        username: 'jane_smith',
        email: 'jane@example.com',
        name: 'Jane Smith',
        type: 'user',
        status: 1,
      },
      {
        username: 'bob_wilson',
        email: 'bob@example.com',
        name: 'Bob Wilson',
        type: 'user',
        status: 1,
      },
      {
        username: 'alice_brown',
        email: 'alice@example.com',
        name: 'Alice Brown',
        type: 'user',
        status: 0,
      },
      {
        username: 'charlie_davis',
        email: 'charlie@example.com',
        name: 'Charlie Davis',
        type: 'user',
        status: 1,
      },
    ];

    const createdUsers = [];
    for (const userData of users) {
      let user = await this.prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (!user) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        user = await this.prisma.user.create({
          data: {
            ...userData,
            password: hashedPassword,
            approved_at: new Date(),
            email_verified_at: new Date(),
          },
        });
      }
      createdUsers.push(user);

      // Assign roles to users
      const roles = ['2', '3', '4', '5'];
      const roleIndex = createdUsers.length - 1;
      const roleId = roles[roleIndex % roles.length];

      const existingRoleUser = await this.prisma.roleUser.findUnique({
        where: {
          role_id_user_id: {
            role_id: roleId,
            user_id: user.id,
          },
        },
      });

      if (!existingRoleUser) {
        await this.prisma.roleUser.create({
          data: {
            user_id: user.id,
            role_id: roleId,
          },
        });
      }
    }

    // Assign system user role
    const existingSystemRole = await this.prisma.roleUser.findUnique({
      where: {
        role_id_user_id: {
          role_id: '1',
          user_id: systemUser.id,
        },
      },
    });

    if (!existingSystemRole) {
      await this.prisma.roleUser.create({
        data: {
          user_id: systemUser.id,
          role_id: '1',
        },
      });
    }

    console.log(`✅ Created ${createdUsers.length + 1} users`);
  }

  async permissionSeed() {
    let i = 0;
    const permissions = [];
    const permissionGroups = [
      { title: 'system_tenant_management', subject: 'SystemTenant' },
      { title: 'user_management', subject: 'User' },
      { title: 'role_management', subject: 'Role' },
      { title: 'Project', subject: 'Project' },
      {
        title: 'Task',
        subject: 'Task',
        scope: ['read', 'create', 'update', 'show', 'delete', 'assign'],
      },
      { title: 'Comment', subject: 'Comment' },
    ];

    for (const permissionGroup of permissionGroups) {
      if (permissionGroup['scope']) {
        for (const permission of permissionGroup['scope']) {
          const title = permissionGroup.title + '_' + permission;
          const existing = await this.prisma.permission.findFirst({
            where: { title },
          });
          if (!existing) {
            permissions.push({
              id: String(++i),
              title: title,
              action: StringHelper.cfirst(permission),
              subject: permissionGroup.subject,
            });
          }
        }
      } else {
        for (const permission of [
          'read',
          'create',
          'update',
          'show',
          'delete',
        ]) {
          const title = permissionGroup.title + '_' + permission;
          const existing = await this.prisma.permission.findFirst({
            where: { title },
          });
          if (!existing) {
            permissions.push({
              id: String(++i),
              title: title,
              action: StringHelper.cfirst(permission),
              subject: permissionGroup.subject,
            });
          }
        }
      }
    }

    if (permissions.length > 0) {
      await this.prisma.permission.createMany({
        data: permissions,
        skipDuplicates: true,
      });
    }

    console.log(`✅ Created ${permissions.length} permissions`);
  }

  async permissionRoleSeed() {
    const all_permissions = await this.prisma.permission.findMany();
    const su_admin_permissions = all_permissions.filter(function (permission) {
      return permission.title.substring(0, 25) == 'system_tenant_management_';
    });

    const adminPermissionRoleArray = [];
    for (const su_admin_permission of su_admin_permissions) {
      const existing = await this.prisma.permissionRole.findUnique({
        where: {
          permission_id_role_id: {
            permission_id: su_admin_permission.id,
            role_id: '1',
          },
        },
      });
      if (!existing) {
        adminPermissionRoleArray.push({
          role_id: '1',
          permission_id: su_admin_permission.id,
        });
      }
    }
    if (adminPermissionRoleArray.length > 0) {
      await this.prisma.permissionRole.createMany({
        data: adminPermissionRoleArray,
        skipDuplicates: true,
      });
    }

    const project_admin_permissions = all_permissions.filter(
      function (permission) {
        return permission.title.substring(0, 25) != 'system_tenant_management_';
      },
    );

    const projectAdminPermissionRoleArray = [];
    for (const admin_permission of project_admin_permissions) {
      const existing = await this.prisma.permissionRole.findUnique({
        where: {
          permission_id_role_id: {
            permission_id: admin_permission.id,
            role_id: '2',
          },
        },
      });
      if (!existing) {
        projectAdminPermissionRoleArray.push({
          role_id: '2',
          permission_id: admin_permission.id,
        });
      }
    }
    if (projectAdminPermissionRoleArray.length > 0) {
      await this.prisma.permissionRole.createMany({
        data: projectAdminPermissionRoleArray,
        skipDuplicates: true,
      });
    }

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
      const existing = await this.prisma.permissionRole.findUnique({
        where: {
          permission_id_role_id: {
            permission_id: project_manager_permission.id,
            role_id: '3',
          },
        },
      });
      if (!existing) {
        projectManagerPermissionRoleArray.push({
          role_id: '3',
          permission_id: project_manager_permission.id,
        });
      }
    }
    if (projectManagerPermissionRoleArray.length > 0) {
      await this.prisma.permissionRole.createMany({
        data: projectManagerPermissionRoleArray,
        skipDuplicates: true,
      });
    }

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
      const existing = await this.prisma.permissionRole.findUnique({
        where: {
          permission_id_role_id: {
            permission_id: project_manager_permission.id,
            role_id: '4',
          },
        },
      });
      if (!existing) {
        memberPermissionRoleArray.push({
          role_id: '4',
          permission_id: project_manager_permission.id,
        });
      }
    }
    if (memberPermissionRoleArray.length > 0) {
      await this.prisma.permissionRole.createMany({
        data: memberPermissionRoleArray,
        skipDuplicates: true,
      });
    }

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
      const existing = await this.prisma.permissionRole.findUnique({
        where: {
          permission_id_role_id: {
            permission_id: viewer_permission.id,
            role_id: '5',
          },
        },
      });
      if (!existing) {
        viewerPermissionRoleArray.push({
          role_id: '5',
          permission_id: viewer_permission.id,
        });
      }
    }
    if (viewerPermissionRoleArray.length > 0) {
      await this.prisma.permissionRole.createMany({
        data: viewerPermissionRoleArray,
        skipDuplicates: true,
      });
    }

    console.log('✅ Permission roles assigned');
  }

  async roleSeed() {
    const roles = [
      {
        id: '1',
        title: 'Super Admin',
        name: 'su_admin',
      },
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
    ];

    for (const role of roles) {
      const existing = await this.prisma.role.findUnique({
        where: { id: role.id },
      });
      if (!existing) {
        await this.prisma.role.create({
          data: role,
        });
      }
    }
    console.log('✅ Roles created');
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
    console.log('✅ Subscription features and plans created');
  }

  async locationSeed() {
    const locations = [
      {
        city: 'New York',
        state: 'NY',
        country: 'USA',
        address: '123 Main St',
        zip: '10001',
        lat: 40.7128,
        lng: -74.006,
      },
      {
        city: 'Los Angeles',
        state: 'CA',
        country: 'USA',
        address: '456 Hollywood Blvd',
        zip: '90028',
        lat: 34.0522,
        lng: -118.2437,
      },
      {
        city: 'Chicago',
        state: 'IL',
        country: 'USA',
        address: '789 Michigan Ave',
        zip: '60601',
        lat: 41.8781,
        lng: -87.6298,
      },
      {
        city: 'Houston',
        state: 'TX',
        country: 'USA',
        address: '321 Main St',
        zip: '77002',
        lat: 29.7604,
        lng: -95.3698,
      },
      {
        city: 'Phoenix',
        state: 'AZ',
        country: 'USA',
        address: '654 Camelback Rd',
        zip: '85016',
        lat: 33.4484,
        lng: -112.074,
      },
    ];

    const createdLocations = [];
    for (const loc of locations) {
      const existing = await this.prisma.location.findFirst({
        where: {
          address: loc.address,
          city: loc.city,
          state: loc.state,
        },
      });

      let location;
      if (!existing) {
        location = await this.prisma.location.create({
          data: loc,
        });
      } else {
        location = existing;
      }
      createdLocations.push(location);
    }
    console.log(`✅ Created ${createdLocations.length} locations`);
    return createdLocations;
  }

  async shipperFacilitySeed() {
    const locations = await this.prisma.location.findMany();
    const facilities = [
      {
        name: 'ABC Logistics Center',
        normalized_name: 'abc_logistics_center',
      },
      {
        name: 'XYZ Distribution Hub',
        normalized_name: 'xyz_distribution_hub',
      },
      {
        name: 'Global Shipping Terminal',
        normalized_name: 'global_shipping_terminal',
      },
      {
        name: 'Pacific Freight Depot',
        normalized_name: 'pacific_freight_depot',
      },
      {
        name: 'Atlantic Warehousing',
        normalized_name: 'atlantic_warehousing',
      },
    ];

    const createdFacilities = [];
    for (let i = 0; i < facilities.length; i++) {
      const existing = await this.prisma.shipperFacility.findUnique({
        where: { normalized_name: facilities[i].normalized_name },
      });

      let facility;
      if (!existing) {
        facility = await this.prisma.shipperFacility.create({
          data: {
            ...facilities[i],
            location_id: locations[i % locations.length].id,
          },
        });
      } else {
        facility = existing;
      }
      createdFacilities.push(facility);
    }
    console.log(`✅ Created ${createdFacilities.length} shipper facilities`);
    return createdFacilities;
  }

  async stopLogSeed() {
    const users = await this.prisma.user.findMany();
    const facilities = await this.prisma.shipperFacility.findMany();
    const locations = await this.prisma.location.findMany();

    const stopLogs = [];
    const statuses = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
    const rateConfirmeds = ['YES', 'NO', 'NOT_SURE'] as const;

    // Check existing stop logs to avoid duplicates
    const existingStopLogs = await this.prisma.stopLog.findMany();
    const usedLocationIds = new Set(
      existingStopLogs
        .filter((s) => s.arrival_location_id)
        .map((s) => s.arrival_location_id),
    );

    let locationIndex = 0;
    for (let i = 0; i < 15; i++) {
      const user = users[i % users.length];
      const facility = facilities[i % facilities.length];

      // Find unused location for arrival
      let arrivalLoc = null;
      let facilityLoc = null;

      // Try to find unused locations
      for (let j = 0; j < locations.length; j++) {
        const idx = (locationIndex + j) % locations.length;
        if (!usedLocationIds.has(locations[idx].id)) {
          arrivalLoc = locations[idx];
          usedLocationIds.add(locations[idx].id);
          locationIndex = (idx + 1) % locations.length;
          break;
        }
      }

      // If all locations are used, create new ones
      if (!arrivalLoc) {
        const newLocation = await this.prisma.location.create({
          data: {
            city: `City ${Date.now() + i}`,
            state: 'XX',
            country: 'USA',
            address: `${i + 100} New St`,
            zip: `${10000 + i}`,
            lat: 30 + Math.random() * 10,
            lng: -90 + Math.random() * 10,
          },
        });
        arrivalLoc = newLocation;
      }

      // Use a different location for facility address or create new
      if (locations.length > 0) {
        facilityLoc = locations[(i + 1) % locations.length];
      } else {
        const newLocation = await this.prisma.location.create({
          data: {
            city: `Facility City ${i}`,
            state: 'XX',
            country: 'USA',
            address: `${i + 200} Facility St`,
            zip: `${20000 + i}`,
            lat: 30 + Math.random() * 10,
            lng: -90 + Math.random() * 10,
          },
        });
        facilityLoc = newLocation;
      }

      const arrivedAt = new Date();
      arrivedAt.setHours(arrivedAt.getHours() - Math.floor(Math.random() * 48));

      try {
        const stopLog = await this.prisma.stopLog.create({
          data: {
            user_id: user.id,
            shipper_facility_id: facility.id,
            arrival_location_id: arrivalLoc.id,
            facility_address_id: facilityLoc.id,
            facility_name: facility.name,
            shipper_name: `Shipper ${i + 1}`,
            load_number: `LOAD-${String(1000 + i).padStart(4, '0')}`,
            bol_number: `BOL-${String(2000 + i).padStart(4, '0')}`,
            broker_name: `Broker ${i + 1}`,
            broker_email: `broker${i + 1}@example.com`,
            broker_mc_number: `MC-${String(3000 + i).padStart(4, '0')}`,
            free_time_minutes: 120 + Math.floor(Math.random() * 60),
            detention_rate_pence: 50 + Math.floor(Math.random() * 100),
            arrived_at: arrivedAt,
            docked_at: new Date(arrivedAt.getTime() + 15 * 60000),
            completed_at: new Date(arrivedAt.getTime() + 120 * 60000),
            departed_at: new Date(arrivedAt.getTime() + 150 * 60000),
            status: statuses[i % statuses.length],
            rate_con_detention_confirmed:
              rateConfirmeds[i % rateConfirmeds.length],
          },
        });
        stopLogs.push(stopLog);
      } catch (error) {
        // Skip if unique constraint fails
        console.log(`Skipping stop log ${i + 1} due to unique constraint`);
        continue;
      }
    }
    console.log(`✅ Created ${stopLogs.length} stop logs`);
    return stopLogs;
  }

  async claimSeed() {
    const users = await this.prisma.user.findMany();
    const facilities = await this.prisma.shipperFacility.findMany();
    const stopLogs = await this.prisma.stopLog.findMany();

    const claims = [];
    const statuses = ['DRAFT', 'SUBMITTED', 'PAID', 'DENIED'] as const;
    const sendMethods = ['EMAIL', 'SMS', 'SHARE'] as const;

    for (let i = 0; i < Math.min(10, stopLogs.length); i++) {
      const user = users[i % users.length];
      const facility = facilities[i % facilities.length];
      const stopLog = stopLogs[i];

      // Check if claim already exists for this stop log
      const existingClaim = await this.prisma.claim.findUnique({
        where: { stop_log_id: stopLog.id },
      });

      if (!existingClaim) {
        const claim = await this.prisma.claim.create({
          data: {
            user_id: user.id,
            shipper_facility_id: facility.id,
            stop_log_id: stopLog.id,
            claim_amount: 500 + Math.floor(Math.random() * 2000),
            paid_amount:
              Math.random() > 0.5
                ? 500 + Math.floor(Math.random() * 1000)
                : null,
            status: statuses[i % statuses.length],
            recipient_email: `recipient${i + 1}@example.com`,
            send_method: sendMethods[i % sendMethods.length],
            sent_at: new Date(
              Date.now() - Math.floor(Math.random() * 30) * 86400000,
            ),
            recourse_level: Math.floor(Math.random() * 5),
            proof_package_version: 1,
          },
        });
        claims.push(claim);
      }
    }
    console.log(`✅ Created ${claims.length} claims`);
    return claims;
  }

  async attachmentSeed() {
    const stopLogs = await this.prisma.stopLog.findMany();
    const claims = await this.prisma.claim.findMany();

    const attachments = [];
    const types = [
      'BOL',
      'RATE_CONFIRMATION',
      'ELD_SCREENSHOT',
      'FACILITY_STAMP_PHOTO',
      'PROOF_PACKAGE',
      'DEMAND_LETTER',
      'BOND_CLAIM_PACKET',
      'COURT_FILING_PACKET',
      'COMPLETE_CASE_FILE',
      'DETENTION_SUMMARY',
      'OTHER',
    ] as const;

    const existingAttachments = await this.prisma.attachment.findMany();
    const usedStopLogIds = new Set(
      existingAttachments.map((a) => a.stop_log_id),
    );
    const usedClaimIds = new Set(existingAttachments.map((a) => a.claim_id));

    for (let i = 0; i < 20; i++) {
      let stopLogId = null;
      let claimId = null;

      if (i % 2 === 0) {
        // Find unused stop log
        for (const stopLog of stopLogs) {
          if (!usedStopLogIds.has(stopLog.id)) {
            stopLogId = stopLog.id;
            usedStopLogIds.add(stopLog.id);
            break;
          }
        }
      } else {
        // Find unused claim
        for (const claim of claims) {
          if (!usedClaimIds.has(claim.id)) {
            claimId = claim.id;
            usedClaimIds.add(claim.id);
            break;
          }
        }
      }

      const type = types[i % types.length];

      try {
        const attachment = await this.prisma.attachment.create({
          data: {
            stop_log_id: stopLogId,
            claim_id: claimId,
            type: type,
            file_url: `https://storage.example.com/files/file_${i + 1}.pdf`,
            file_name: `document_${i + 1}.pdf`,
            mime_type: 'application/pdf',
            size_bytes: 1024 * (100 + Math.floor(Math.random() * 900)),
          },
        });
        attachments.push(attachment);
      } catch (error) {
        continue;
      }
    }
    console.log(`✅ Created ${attachments.length} attachments`);
    return attachments;
  }

  async shipperFacilityRatingSeed() {
    const users = await this.prisma.user.findMany();
    const facilities = await this.prisma.shipperFacility.findMany();
    const stopLogs = await this.prisma.stopLog.findMany();

    const ratings = [];
    const existingRatings = await this.prisma.shipperFacilityRating.findMany();
    const usedStopLogIds = new Set(existingRatings.map((r) => r.stop_log_id));

    for (let i = 0; i < Math.min(8, stopLogs.length); i++) {
      const user = users[i % users.length];
      const facility = facilities[i % facilities.length];
      const stopLog = stopLogs[i];

      if (!usedStopLogIds.has(stopLog.id)) {
        const rating = await this.prisma.shipperFacilityRating.create({
          data: {
            user_id: user.id,
            shipper_facility_id: facility.id,
            stop_log_id: stopLog.id,
            rating: 50 + Math.random() * 50,
            review: `Good experience with ${facility.name}. Professional staff and efficient service.`,
          },
        });
        ratings.push(rating);
      }
    }
    console.log(`✅ Created ${ratings.length} shipper facility ratings`);
    return ratings;
  }

  async notificationSeed() {
    const users = await this.prisma.user.findMany();

    // Create notification events
    const events = [
      { type: 'claim_submitted', text: 'New claim submitted' },
      { type: 'claim_approved', text: 'Claim approved' },
      { type: 'claim_denied', text: 'Claim denied' },
      { type: 'payment_received', text: 'Payment received' },
      { type: 'stop_log_created', text: 'New stop log created' },
    ];

    const createdEvents = [];
    for (const eventData of events) {
      const existing = await this.prisma.notificationEvent.findFirst({
        where: { type: eventData.type },
      });

      let event;
      if (!existing) {
        event = await this.prisma.notificationEvent.create({
          data: eventData,
        });
      } else {
        event = existing;
      }
      createdEvents.push(event);
    }

    const notifications = [];
    const existingNotifications = await this.prisma.notification.findMany();
    const usedPairs = new Set(
      existingNotifications.map((n) => `${n.sender_id}-${n.receiver_id}`),
    );

    for (let i = 0; i < 15; i++) {
      const sender = users[i % users.length];
      const receiver = users[(i + 1) % users.length];
      const event = createdEvents[i % createdEvents.length];
      const pairKey = `${sender.id}-${receiver.id}`;

      if (!usedPairs.has(pairKey)) {
        const notification = await this.prisma.notification.create({
          data: {
            sender_id: sender.id,
            receiver_id: receiver.id,
            notification_event_id: event.id,
            read_at: i % 3 === 0 ? new Date() : null,
            status: 1,
            entity_id: `entity_${i + 1}`,
          },
        });
        notifications.push(notification);
      }
    }
    console.log(`✅ Created ${notifications.length} notifications`);
    return notifications;
  }

  async settingSeed() {
    const settings = [
      {
        category: 'general',
        label: 'Site Name',
        key: 'site_name',
        default_value: 'Luke Thompson Logistics',
      },
      {
        category: 'general',
        label: 'Site URL',
        key: 'site_url',
        default_value: 'https://example.com',
      },
      {
        category: 'email',
        label: 'Email From',
        key: 'email_from',
        default_value: 'noreply@example.com',
      },
      {
        category: 'email',
        label: 'Email From Name',
        key: 'email_from_name',
        default_value: 'Luke Thompson Logistics',
      },
      {
        category: 'detention',
        label: 'Default Free Time',
        key: 'default_free_time',
        default_value: '120',
      },
      {
        category: 'detention',
        label: 'Default Detention Rate',
        key: 'default_detention_rate',
        default_value: '50',
      },
    ];

    const createdSettings = [];
    for (const settingData of settings) {
      const setting = await this.prisma.setting.upsert({
        where: { key: settingData.key },
        update: settingData,
        create: settingData,
      });
      createdSettings.push(setting);
    }
    console.log(`✅ Created ${createdSettings.length} settings`);
    return createdSettings;
  }

  async userSettingSeed() {
    const users = await this.prisma.user.findMany();
    const settings = await this.prisma.setting.findMany();

    const userSettings = [];
    const existingUserSettings = await this.prisma.userSetting.findMany();
    const usedPairs = new Set(
      existingUserSettings.map((us) => `${us.user_id}-${us.setting_id}`),
    );

    for (let i = 0; i < 10; i++) {
      const user = users[i % users.length];
      const setting = settings[i % settings.length];
      const pairKey = `${user.id}-${setting.id}`;

      if (!usedPairs.has(pairKey)) {
        const userSetting = await this.prisma.userSetting.create({
          data: {
            user_id: user.id,
            setting_id: setting.id,
            value: `User value ${i + 1}`,
          },
        });
        userSettings.push(userSetting);
      }
    }
    console.log(`✅ Created ${userSettings.length} user settings`);
    return userSettings;
  }

  async contactSeed() {
    const contacts = [
      {
        first_name: 'Michael',
        last_name: 'Johnson',
        email: 'michael@example.com',
        phone_number: '+1-555-0101',
        message: 'Interested in your logistics services.',
      },
      {
        first_name: 'Sarah',
        last_name: 'Williams',
        email: 'sarah@example.com',
        phone_number: '+1-555-0102',
        message: 'Need more information about detention claims.',
      },
      {
        first_name: 'David',
        last_name: 'Brown',
        email: 'david@example.com',
        phone_number: '+1-555-0103',
        message: 'Looking for partnership opportunities.',
      },
      {
        first_name: 'Emma',
        last_name: 'Jones',
        email: 'emma@example.com',
        phone_number: '+1-555-0104',
        message: 'Question about stop log management.',
      },
      {
        first_name: 'James',
        last_name: 'Miller',
        email: 'james@example.com',
        phone_number: '+1-555-0105',
        message: 'Interested in Pro Plan subscription.',
      },
    ];

    const createdContacts = [];
    for (const contactData of contacts) {
      const existing = await this.prisma.contact.findFirst({
        where: { email: contactData.email },
      });

      let contact;
      if (!existing) {
        contact = await this.prisma.contact.create({
          data: contactData,
        });
      } else {
        contact = existing;
      }
      createdContacts.push(contact);
    }
    console.log(`✅ Created ${createdContacts.length} contacts`);
    return createdContacts;
  }

  async paymentTransactionSeed() {
    const users = await this.prisma.user.findMany();

    const transactions = [];
    const statuses = ['pending', 'completed', 'failed', 'refunded'];
    const types = ['order', 'subscription', 'payment'];

    for (let i = 0; i < 12; i++) {
      const user = users[i % users.length];
      const refNumber = `REF-${String(1000 + i).padStart(4, '0')}`;

      const existing = await this.prisma.paymentTransaction.findFirst({
        where: { reference_number: refNumber },
      });

      if (!existing) {
        const transaction = await this.prisma.paymentTransaction.create({
          data: {
            user_id: user.id,
            type: types[i % types.length],
            provider: ['stripe', 'paypal', 'square'][i % 3],
            reference_number: refNumber,
            status: statuses[i % statuses.length],
            amount: 100 + Math.random() * 900,
            currency: 'USD',
            paid_amount: 100 + Math.random() * 900,
            paid_currency: 'USD',
            order_id: `ORDER-${String(1000 + i).padStart(4, '0')}`,
          },
        });
        transactions.push(transaction);
      }
    }
    console.log(`✅ Created ${transactions.length} payment transactions`);
    return transactions;
  }

  async userSubscriptionSeed() {
    const users = await this.prisma.user.findMany();
    const plans = await this.prisma.subscriptionPlan.findMany();

    const subscriptions = [];
    const statuses = [
      'TRIALING',
      'ACTIVE',
      'PAST_DUE',
      'CANCELED',
      'EXPIRED',
    ] as const;

    for (let i = 0; i < Math.min(8, users.length); i++) {
      const user = users[i];
      const plan = plans[i % plans.length];

      const existing = await this.prisma.userSubscription.findFirst({
        where: { user_id: user.id, plan_id: plan.id },
      });

      if (!existing) {
        const subscription = await this.prisma.userSubscription.create({
          data: {
            user_id: user.id,
            plan_id: plan.id,
            status: statuses[i % statuses.length],
            started_at: new Date(
              Date.now() - Math.floor(Math.random() * 60) * 86400000,
            ),
            expires_at: new Date(
              Date.now() + Math.floor(Math.random() * 30) * 86400000,
            ),
            purchase_provider: ['stripe', 'apple', 'google'][i % 3],
            purchase_id: `purchase_${i + 1}`,
          },
        });
        subscriptions.push(subscription);
      }
    }
    console.log(`✅ Created ${subscriptions.length} user subscriptions`);
    return subscriptions;
  }

  async featureUsageSeed() {
    const users = await this.prisma.user.findMany();
    const features = await this.prisma.subscriptionFeature.findMany();
    const subscriptions = await this.prisma.userSubscription.findMany();

    const usages = [];
    for (let i = 0; i < 15; i++) {
      const user = users[i % users.length];
      const feature = features[i % features.length];
      const subscription = subscriptions[i % subscriptions.length];

      const existing = await this.prisma.featureUsage.findFirst({
        where: {
          user_id: user.id,
          feature_id: feature.id,
          subscription_id: subscription.id,
          period_start: {
            gte: new Date(Date.now() - 30 * 86400000),
          },
        },
      });

      if (!existing) {
        const usage = await this.prisma.featureUsage.create({
          data: {
            user_id: user.id,
            feature_id: feature.id,
            subscription_id: subscription.id,
            quantity: 1 + Math.floor(Math.random() * 10),
            period_start: new Date(Date.now() - 30 * 86400000),
            period_end: new Date(),
          },
        });
        usages.push(usage);
      }
    }
    console.log(`✅ Created ${usages.length} feature usages`);
    return usages;
  }

  async claimEventSeed() {
    const claims = await this.prisma.claim.findMany();

    const events = [];
    const types = [
      'CLAIM_SENT',
      'FOLLOW_UP_SENT',
      'BROKER_ESCALATION_SENT',
      'DEMAND_LETTER_MAILED',
      'BOND_CLAIM_FILED',
      'CREDIT_REPORT_SUBMITTED',
      'FMCSA_COMPLAINT_FILED',
      'LOAD_BOARD_REVIEW_POSTED',
      'SMALL_CLAIMS_FILED',
      'COLLECTIONS_REFERRED',
      'ATTORNEY_REFERRED',
      'MARKED_PAID',
      'MARKED_DENIED',
      'MARKED_UNCOLLECTABLE',
    ] as const;

    for (let i = 0; i < Math.min(15, claims.length * 2); i++) {
      const claim = claims[i % claims.length];
      const type = types[i % types.length];

      const existing = await this.prisma.claimEvent.findFirst({
        where: {
          claim_id: claim.id,
          type: type,
        },
      });

      if (!existing) {
        const event = await this.prisma.claimEvent.create({
          data: {
            claim_id: claim.id,
            type: type,
            recourse_level: Math.floor(Math.random() * 5),
            followup_level: Math.floor(Math.random() * 3) + 1,
            description: `Event ${i + 1} for claim ${claim.id}`,
          },
        });
        events.push(event);
      }
    }
    console.log(`✅ Created ${events.length} claim events`);
    return events;
  }
}
