export const CONFIG = {
  /**
   * The ID of the Google Sheet  1jt4GN4m5re3K70b9DauuG6t_4imENImUT4VitLxi_aw to fetch data from. 
   * This is found in the URL: docs.google.com/spreadsheets/d/[ID]/edit
   */
  SPREADSHEET_ID: '1471Bp555_KVIHDWsIrOH4JoAVnsCuqDaGX_eUNJbiM8',

  /**
   * How often the dashboard should refresh data (in minutes).
   * The app will automatically align refreshes to the clock.
   * 
   * Examples:
   * 30 => Refreshes at :00 and :30
   * 60 => Refreshes at :00 (Top of the hour)
   * 15 => Refreshes at :00, :15, :30, :45
   */
  REFRESH_INTERVAL_MINUTES: 15,
};