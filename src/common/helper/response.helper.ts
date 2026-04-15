export class ResponseHelper {
  public static success({
    message,
    data,
    meta_data,
  }: {
    message?: string;
    data?: any;
    meta_data?: any;
  }) {
    return {
      success: true,
      ...(message && { message }),
      ...(data && { data }),
      ...(meta_data && { meta_data }),
    };
  }

  public static error({
    message,
    data,
    meta_data,
  }: {
    message?: string;
    data?: any;
    meta_data?: any;
  }) {
    return {
      success: false,
      ...(message && { message }),
      ...(data && { data }),
      ...(meta_data && { meta_data }),
    };
  }
}
