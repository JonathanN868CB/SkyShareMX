export const isSkyshare = (email?: string | null) =>
  !!email && email.toLowerCase().endsWith("@skyshare.com");
