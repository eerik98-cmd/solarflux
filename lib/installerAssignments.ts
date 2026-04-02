import { AssignedInstaller, Quote, User } from '@/types';

const normalizeAssignedInstaller = (assignment: AssignedInstaller): AssignedInstaller => ({
  ...assignment,
  assignedAt: new Date(assignment.assignedAt),
});

export const getAssignedInstallers = (quote: Quote): AssignedInstaller[] => {
  if (quote.assignedInstallers && quote.assignedInstallers.length > 0) {
    return quote.assignedInstallers.map(normalizeAssignedInstaller);
  }

  if (!quote.allocatedInstallerId) {
    return [];
  }

  return [
    {
      installerId: quote.allocatedInstallerId,
      installerNickname: quote.allocatedInstallerId,
      assignedAt: quote.allocatedAt ? new Date(quote.allocatedAt) : new Date(0),
    },
  ];
};

export const isInstallerAssignedToQuote = (quote: Quote, installer?: Pick<User, 'id' | 'nickname'> | null) => {
  if (!installer) return false;
  return getAssignedInstallers(quote).some(
    (assignment) =>
      assignment.installerId === installer.id ||
      assignment.installerId === installer.nickname ||
      assignment.installerNickname === installer.nickname
  );
};

export const getAssignedInstallerNames = (quote: Quote) => {
  return getAssignedInstallers(quote).map((assignment) => assignment.installerNickname);
};

export const getPrimaryAssignedInstallerName = (quote: Quote) => {
  return getAssignedInstallers(quote)[0]?.installerNickname;
};

export const applyAssignedInstallersToQuote = (quote: Quote, assignments: AssignedInstaller[]): Quote => {
  const normalizedAssignments = assignments.map(normalizeAssignedInstaller);
  const primary = normalizedAssignments[0];

  return {
    ...quote,
    assignedInstallers: normalizedAssignments.length > 0 ? normalizedAssignments : undefined,
    allocatedInstallerId: primary?.installerNickname,
    allocatedAt: primary?.assignedAt,
  };
};