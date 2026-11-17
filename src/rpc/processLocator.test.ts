import { describe, expect, it } from 'vitest';
import {
  getProcessNames,
  isAntigravityProcess,
  parseWindowsNetstatPorts,
  parseWindowsProcessCandidates
} from './processLocator';

describe('processLocator Windows support', () => {
  it('includes Windows binary names in getProcessNames when platform is win32', () => {
    // getProcessNames checks os.platform(), so on Windows it should return Windows binaries
    if (process.platform === 'win32') {
      const names = getProcessNames();
      expect(names).toEqual(['language_server.exe', 'language_server_windows_x64.exe', 'language_server']);
    }
  });

  describe('parseWindowsProcessCandidates', () => {
    it('parses a single JSON process object correctly', () => {
      const json = JSON.stringify({
        ProcessId: 14092,
        ParentProcessId: 3676,
        Name: 'language_server.exe',
        CommandLine: 'C:\\Users\\User\\bin\\language_server.exe --csrf_token c099b7f4-b521-4cad-a864-9e311e3f8cef --app_data_dir antigravity'
      });

      const candidates = parseWindowsProcessCandidates(json);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toEqual({
        pid: 14092,
        ppid: 3676,
        extensionPort: 0,
        csrfToken: 'c099b7f4-b521-4cad-a864-9e311e3f8cef'
      });
    });

    it('parses an array of JSON process objects and filters out shell processes', () => {
      const json = JSON.stringify([
        {
          ProcessId: 14092,
          ParentProcessId: 3676,
          Name: 'language_server.exe',
          CommandLine: 'C:\\resources\\bin\\language_server.exe --extension_server_port 64998 --csrf_token token-123 --app_data_dir antigravity'
        },
        {
          ProcessId: 7720,
          ParentProcessId: 2972,
          Name: 'cmd.exe',
          CommandLine: 'cmd.exe /c "powershell ... --csrf_token fake --app_data_dir antigravity"'
        },
        {
          ProcessId: 12436,
          ParentProcessId: 7720,
          Name: 'powershell.exe',
          CommandLine: 'powershell -Command "Get-CimInstance ... --csrf_token fake --app_data_dir antigravity"'
        }
      ]);

      const candidates = parseWindowsProcessCandidates(json);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toEqual({
        pid: 14092,
        ppid: 3676,
        extensionPort: 64998,
        csrfToken: 'token-123'
      });
    });

    it('returns empty array when input is empty or invalid JSON', () => {
      expect(parseWindowsProcessCandidates('')).toEqual([]);
      expect(parseWindowsProcessCandidates('invalid json')).toEqual([]);
    });
  });

  describe('parseWindowsNetstatPorts', () => {
    it('extracts listening ports for the given PID', () => {
      const netstatOutput = `
  TCP    127.0.0.1:64998        0.0.0.0:0              LISTENING       14092
  TCP    127.0.0.1:64998        127.0.0.1:50807        ESTABLISHED     14092
  TCP    127.0.0.1:64999        0.0.0.0:0              LISTENING       14092
  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       99999
  TCP    [::]:65001             [::]:0                 LISTENING       14092
`;

      const ports = parseWindowsNetstatPorts(netstatOutput, 14092);
      expect(ports).toEqual([64998, 64999, 65001]);
    });

    it('ignores non-listening connections and other PIDs', () => {
      const netstatOutput = `
  TCP    127.0.0.1:50807        127.0.0.1:64998        ESTABLISHED     14092
  TCP    198.18.0.1:50909       198.18.0.8:443         ESTABLISHED     14092
  TCP    127.0.0.1:8888         0.0.0.0:0              LISTENING       55555
`;

      const ports = parseWindowsNetstatPorts(netstatOutput, 14092);
      expect(ports).toEqual([]);
    });
  });

  describe('isAntigravityProcess', () => {
    it('detects Windows path and command line flags', () => {
      expect(isAntigravityProcess('C:\\Users\\test\\AppData\\Local\\Programs\\antigravity\\resources\\bin\\language_server.exe')).toBe(true);
      expect(isAntigravityProcess('language_server.exe --app_data_dir antigravity')).toBe(true);
      expect(isAntigravityProcess('some_other_process.exe --param 123')).toBe(false);
    });
  });
});
