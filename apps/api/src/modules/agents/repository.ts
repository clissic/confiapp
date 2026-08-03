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

export class AgentsRepository {
  async findUserById(userId: string): Promise<UserDocument | null> {
    return UserModel.findOne({ _id: userId, deletedAt: null }).exec();
  }

  async saveOnboardingDraft(
    userId: string,
    input: SaveAgentOnboardingDto,
  ): Promise<UserDocument | null> {
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

    if (input.timezone !== undefined) {
      $set['schedule.timezone'] = input.timezone;
      $set['preferences.timezone'] = input.timezone;
    }
    if (input.weeklySlots !== undefined) {
      $set['schedule.weeklySlots'] = input.weeklySlots;
    }
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
        | 'workAreaLabel'
        | 'workAreaCity'
        | 'workAreaCountry'
        | 'coverageRadiusKm'
        | 'hourlyRateCents'
        | 'currency'
      >
    > & { termsAccepted: true },
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
      workAreaLabel: input.workAreaLabel,
      workAreaCity: input.workAreaCity,
      workAreaCountry: input.workAreaCountry,
      coverageRadiusKm: input.coverageRadiusKm,
      hourlyRateCents: input.hourlyRateCents,
      currency: input.currency,
      draftStep: 5,
      submittedAt: now,
      activatedAt: now,
    };

    user.schedule = {
      ...user.schedule,
      timezone: input.timezone,
      weeklySlots: input.weeklySlots,
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
          hourlyRateCents: input.hourlyRateCents,
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
}
