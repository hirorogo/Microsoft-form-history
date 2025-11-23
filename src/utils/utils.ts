export const getFormId = (path: string) => {
  const splits = path.split("/");
  return splits.find((item) => item.length > 10) ?? "";
};
