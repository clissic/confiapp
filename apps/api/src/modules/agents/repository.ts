import type { HydratedDocument } from 'mongoose';
import {
  AgentOnboardingStatus,
  PlatformRole,
  type IAgentAvailability,
  type IUser,
} from '@confiapp/database';

import { AgentAvailabilityModel, UserModel } from '../../database/models';
import type { SaveAgentOnboardingDto } from './dto';
import { AGENT_TERMS_VERSION } from './constants';

export type UserDocument = HydratedDocument<IUser>;
export type AgentAvailabilityDocument = HydratedDocument<IAgentAvailability>;

function applyScheduleDraftFields(
  $set: Record<string, unknown>,
  input: SaveAgentOnboardingDto,
): { availabilityPatch: Record<string, unknown> } {
  const availabilityPatch: Record<string, unknown> = {};

  if (input.timezone !== undefined) {
    $set['schedule.timezone'] = input.timezone;
    $set['preferences.timezone'] = input.timezone;
    availabilityPatch.timezone = input.timezone;
  }

  if (input.unspecifiedSchedule !== undefined) {
    $set['schedule.unspecifiedSchedule'] = input.unspecifiedSchedule;
  }

  if (input.unspecifiedSchedule === true) {
    $set['schedule.weeklySlots'] = [];
    availabilityPatch.weeklySlots = [];
  } else if (input.weeklySlots !== undefined) {
    $set['schedule.weeklySlots'] = input.weeklySlots;
    availabilityPatch.weeklySlots = input.weeklySlots;
  }

  return { availabilityPatch };
}

export class AgentsRepository {
  async findUserById(userId: string): Promise<UserDocument | null> {
    return UserModel.findOne({ _id: userId, deletedAt: null }).exec();
  }

  async saveOnboardingDraft(
    userId: string,
    input: SaveAgentOnboardingDto,
  ): Promise<UserDocument | null> {
    const existing = await this.findUserById(userId);
    if (!existing) return null;

    const status = existing.agent?.status ?? AgentOnboardingStatus.NONE;
    const isRegistered =
      status === AgentOnboardingStatus.ACTIVE || status === AgentOnboardingStatus.INACTIVE;

    if (isRegistered) {
      const $set: Record<string, unknown> = {};
      const { availabilityPatch } = applyScheduleDraftFields($set, input);
      if (input.workAreaLabel !== undefined) {
        $set['agent.workAreaLabel'] = input.workAreaLabel;
        $set['location.label'] = input.workAreaLabel;
      }
      if (input.workAreaCity !== undefined) {
        $set['agent.workAreaCity'] = input.workAreaCity;
        $set['location.address.city'] = input.workAreaCity;
      }
      if (input.workAreaCountry !== undefined) {
        $set['agent.workAreaCountry'] = input.workAreaCountry;
        $set['location.address.country'] = input.workAreaCountry;
      }
      if (input.coverageRadiusKm !== undefined) {
        $set['agent.coverageRadiusKm'] = input.coverageRadiusKm;
        $set['location.coverageRadiusKm'] = input.coverageRadiusKm;
        $set['location.updatedAt'] = new Date();
      }

      if (Object.keys($set).length === 0) {
        return existing;
      }

      if (
        Object.keys(availabilityPatch).length > 0 ||
        input.workAreaLabel !== undefined ||
        input.coverageRadiusKm !== undefined
      ) {
        await AgentAvailabilityModel.findOneAndUpdate(
          { user: userId },
          {
            $set: {
              ...availabilityPatch,
              ...(input.workAreaLabel !== undefined ? { coverageLabel: input.workAreaLabel } : {}),
              ...(input.coverageRadiusKm !== undefined
                ? { coverageRadiusKm: input.coverageRadiusKm }
                : {}),
            },
          },
        ).exec();
      }

      return UserModel.findOneAndUpdate(
        { _id: userId, deletedAt: null },
        { $set },
        { new: true, runValidators: true },
      ).exec();
    }

    const $set: Record<string, unknown> = {
      'agent.status': AgentOnboardingStatus.DRAFT,
    };

    if (input.termsAccepted === true) {
      $set['agent.termsAccepted'] = true;
      $set['agent.termsAcceptedAt'] = new Date();
      $set['agent.termsVersion'] = AGENT_TERMS_VERSION;
    } else if (input.termsAccepted === false) {
      $set['agent.termsAccepted'] = false;
      $set['agent.termsAcceptedAt'] = null;
    }

    applyScheduleDraftFields($set, input);
    if (input.workAreaLabel !== undefined) {
      $set['agent.workAreaLabel'] = input.workAreaLabel;
      $set['location.label'] = input.workAreaLabel;
    }
    if (input.workAreaCity !== undefined) {
      $set['agent.workAreaCity'] = input.workAreaCity;
      $set['location.address.city'] = input.workAreaCity;
    }
    if (input.workAreaCountry !== undefined) {
      $set['agent.workAreaCountry'] = input.workAreaCountry;
      $set['location.address.country'] = input.workAreaCountry;
    }
    if (input.coverageRadiusKm !== undefined) {
      $set['agent.coverageRadiusKm'] = input.coverageRadiusKm;
      $set['location.coverageRadiusKm'] = input.coverageRadiusKm;
      $set['location.updatedAt'] = new Date();
    }
    if (input.hourlyRateCents !== undefined) {
      $set['agent.hourlyRateCents'] = input.hourlyRateCents;
    }
    if (input.ratesAccepted === true) {
      $set['agent.ratesAccepted'] = true;
      $set['agent.ratesAcceptedAt'] = new Date();
    } else if (input.ratesAccepted === false) {
      $set['agent.ratesAccepted'] = false;
      $set['agent.ratesAcceptedAt'] = null;
    }
    if (input.currency !== undefined) {
      $set['agent.currency'] = input.currency;
    }
    if (input.draftStep !== undefined) {
      $set['agent.draftStep'] = input.draftStep;
    }

    return UserModel.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      { $set },
      { new: true, runValidators: true },
    ).exec();
  }

  async activateAgent(
    userId: string,
    input: Required<
      Pick<
        SaveAgentOnboardingDto,
        | 'timezone'
        | 'weeklySlots'
        | 'unspecifiedSchedule'
        | 'workAreaLabel'
        | 'workAreaCity'
        | 'workAreaCountry'
        | 'coverageRadiusKm'
        | 'currency'
      >
    > & { termsAccepted: true; ratesAccepted: true },
  ): Promise<UserDocument | null> {
    const now = new Date();

    const user = await UserModel.findOne({ _id: userId, deletedAt: null }).exec();
    if (!user) return null;

    const roles = new Set(user.roles?.length ? user.roles : [user.role]);
    roles.add(PlatformRole.AGENT);
    if (user.role === PlatformRole.USER) {
      user.role = PlatformRole.AGENT;
    }
    user.roles = [...roles];

    user.agent = {
      status: AgentOnboardingStatus.ACTIVE,
      termsAccepted: true,
      termsAcceptedAt: now,
      termsVersion: AGENT_TERMS_VERSION,
      ratesAccepted: true,
      ratesAcceptedAt: now,
      workAreaLabel: input.workAreaLabel,
      workAreaCity: input.workAreaCity,
      workAreaCountry: input.workAreaCountry,
      coverageRadiusKm: input.coverageRadiusKm,
      currency: input.currency,
      draftStep: 5,
      submittedAt: now,
      activatedAt: now,
    };

    user.schedule = {
      ...user.schedule,
      timezone: input.timezone,
      weeklySlots: input.unspecifiedSchedule ? [] : input.weeklySlots,
      unspecifiedSchedule: input.unspecifiedSchedule,
      isAcceptingAssignments: true,
      maxActiveTransactions: user.schedule?.maxActiveTransactions ?? 5,
      exceptions: user.schedule?.exceptions ?? [],
    };

    user.location = {
      ...user.location,
      label: input.workAreaLabel,
      coverageRadiusKm: input.coverageRadiusKm,
      updatedAt: now,
      address: {
        ...(user.location?.address ?? {}),
        city: input.workAreaCity,
        country: input.workAreaCountry,
      },
    };

    user.preferences = {
      ...user.preferences,
      timezone: input.timezone,
      currency: input.currency,
    };

    await user.save();

    await AgentAvailabilityModel.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          timezone: input.timezone,
          isAcceptingAssignments: true,
          weeklySlots: input.weeklySlots,
          coverageLabel: input.workAreaLabel,
          coverageRadiusKm: input.coverageRadiusKm,
          currency: input.currency,
          termsAcceptedAt: now,
          termsVersion: AGENT_TERMS_VERSION,
          deletedAt: null,
        },
        $setOnInsert: {
          user: userId,
          maxActiveTransactions: 5,
          exceptions: [],
        },
      },
      { upsert: true, new: true, runValidators: true },
    ).exec();

    return user;
  }

  async setAgentActivity(
    userId: string,
    status: AgentOnboardingStatus.ACTIVE | AgentOnboardingStatus.INACTIVE,
  ): Promise<UserDocument | null> {
    const accepting = status === AgentOnboardingStatus.ACTIVE;
    const user = await UserModel.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      {
        $set: {
          'agent.status': status,
          'schedule.isAcceptingAssignments': accepting,
        },
      },
      { new: true, runValidators: true },
    ).exec();

    if (user) {
      await AgentAvailabilityModel.findOneAndUpdate(
        { user: userId },
        { $set: { isAcceptingAssignments: accepting } },
      ).exec();
    }

    return user;
  }

  /**
   * Cierra la agencia: reinicia onboarding y quita el rol AGENT.
   * No toca rating ni estadísticas (reputación histórica).
   */
  async closeAgency(userId: string): Promise<UserDocument | null> {
    const user = await UserModel.findOne({ _id: userId, deletedAt: null }).exec();
    if (!user) return null;

    const roles = (user.roles?.length ? user.roles : [user.role]).filter(
      (role) => role !== PlatformRole.AGENT,
    );
    if (roles.length === 0) roles.push(PlatformRole.USER);
    user.role = roles.includes(PlatformRole.ADMIN) ? PlatformRole.ADMIN : PlatformRole.USER;
    user.roles = roles;

    user.agent = {
      status: AgentOnboardingStatus.NONE,
      termsAccepted: false,
      ratesAccepted: false,
      currency: user.agent?.currency ?? 'USD',
      draftStep: 1,
    };

    user.schedule = {
      ...user.schedule,
      weeklySlots: [],
      unspecifiedSchedule: false,
      isAcceptingAssignments: false,
      maxActiveTransactions: user.schedule?.maxActiveTransactions ?? 5,
      exceptions: user.schedule?.exceptions ?? [],
      timezone: user.schedule?.timezone ?? user.preferences?.timezone ?? 'America/Montevideo',
    };

    await user.save();

    await AgentAvailabilityModel.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          isAcceptingAssignments: false,
          weeklySlots: [],
          deletedAt: new Date(),
        },
      },
    ).exec();

    return user;
  }
}
