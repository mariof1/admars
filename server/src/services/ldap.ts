import ldap, { Client, SearchOptions } from 'ldapjs';
import { AdSettings } from '../config/database.js';

export interface AdUser {
  dn: string;
  sAMAccountName: string;
  userPrincipalName: string;
  displayName: string;
  givenName: string;
  sn: string;
  mail: string;
  title: string;
  department: string;
  company: string;
  manager: string;
  directReports: string[];
  telephoneNumber: string;
  mobile: string;
  streetAddress: string;
  l: string;
  st: string;
  postalCode: string;
  co: string;
  physicalDeliveryOfficeName: string;
  description: string;
  info: string;
  employeeID: string;
  employeeNumber: string;
  lockoutTime: string;
  userAccountControl: number;
  whenCreated: string;
  whenChanged: string;
  lastLogon: string;
  memberOf: string[];
  thumbnailPhoto?: string; // base64
}

const AD_USER_ATTRIBUTES = [
  'dn', 'sAMAccountName', 'userPrincipalName', 'displayName', 'givenName', 'sn',
  'mail', 'title', 'department', 'company', 'manager', 'directReports',
  'telephoneNumber', 'mobile', 'streetAddress', 'l', 'st', 'postalCode', 'co',
  'physicalDeliveryOfficeName', 'description', 'info', 'employeeID', 'employeeNumber',
  'lockoutTime', 'userAccountControl', 'whenCreated', 'whenChanged', 'lastLogon', 'memberOf',
  'thumbnailPhoto', 'homeDrive', 'homeDirectory', 'scriptPath', 'profilePath',
  'wWWHomePage', 'ipPhone', 'facsimileTelephoneNumber', 'pager',
];

function createClient(settings: AdSettings): Client {
  const opts: ldap.ClientOptions = {
    url: settings.url,
    tlsOptions: {
      rejectUnauthorized: false,
    },
    connectTimeout: 10000,
    timeout: 10000,
  };
  return ldap.createClient(opts);
}

function bindClient(client: Client, dn: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function unbindClient(client: Client): Promise<void> {
  return new Promise((resolve) => {
    client.unbind((err) => resolve());
  });
}

function searchLdap(client: Client, baseDN: string, opts: SearchOptions): Promise<ldap.SearchEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: ldap.SearchEntry[] = [];
    client.search(baseDN, opts, (err, res) => {
      if (err) return reject(err);
      res.on('searchEntry', (entry) => entries.push(entry));
      res.on('error', (err) => reject(err));
      res.on('end', () => resolve(entries));
    });
  });
}

function parseEntry(entry: ldap.SearchEntry): AdUser {
  const obj = (entry as any).ppiObject || (entry as any).object || {};
  const attrs: Record<string, any> = {};

  if (entry.attributes) {
    for (const attr of entry.attributes) {
      const name = attr.type;
      if (name === 'thumbnailPhoto') {
        const buffers = (attr as any).buffers;
        if (buffers && buffers.length > 0) {
          attrs[name] = buffers[0].toString('base64');
        }
      } else {
        const vals = (attr as any).values || [];
        attrs[name] = vals.length === 1 ? vals[0] : vals;
      }
    }
  }

  const get = (key: string): any => attrs[key] ?? obj[key] ?? '';
  const getArr = (key: string): string[] => {
    const v = attrs[key] ?? obj[key];
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  };

  return {
    dn: entry.dn?.toString() ?? obj.dn ?? '',
    sAMAccountName: get('sAMAccountName'),
    userPrincipalName: get('userPrincipalName'),
    displayName: get('displayName'),
    givenName: get('givenName'),
    sn: get('sn'),
    mail: get('mail'),
    title: get('title'),
    department: get('department'),
    company: get('company'),
    manager: get('manager'),
    directReports: getArr('directReports'),
    telephoneNumber: get('telephoneNumber'),
    mobile: get('mobile'),
    streetAddress: get('streetAddress'),
    l: get('l'),
    st: get('st'),
    postalCode: get('postalCode'),
    co: get('co'),
    physicalDeliveryOfficeName: get('physicalDeliveryOfficeName'),
    description: Array.isArray(get('description')) ? get('description')[0] : get('description'),
    info: get('info'),
    employeeID: get('employeeID'),
    employeeNumber: get('employeeNumber'),
    lockoutTime: get('lockoutTime'),
    userAccountControl: parseInt(get('userAccountControl')) || 0,
    whenCreated: get('whenCreated'),
    whenChanged: get('whenChanged'),
    lastLogon: get('lastLogon'),
    memberOf: getArr('memberOf'),
    thumbnailPhoto: attrs['thumbnailPhoto'] || undefined,
  };
}

export async function authenticate(settings: AdSettings, username: string, password: string): Promise<AdUser | null> {
  const client = createClient(settings);
  try {
    // First bind with service account to find user DN
    await bindClient(client, settings.bindDN, settings.bindPassword);

    const filter = `(&(objectClass=user)(objectCategory=person)(|(sAMAccountName=${ldapEscape(username)})(userPrincipalName=${ldapEscape(username)})))`;
    const results = await searchLdap(client, settings.baseDN, {
      filter,
      scope: 'sub',
      attributes: AD_USER_ATTRIBUTES,
    });

    if (results.length === 0) return null;

    const userEntry = results[0];
    const userDn = userEntry.dn?.toString();
    if (!userDn) return null;

    await unbindClient(client);

    // Re-bind as the user to verify password
    const userClient = createClient(settings);
    try {
      await bindClient(userClient, userDn, password);
      await unbindClient(userClient);
    } catch {
      return null;
    }

    return parseEntry(userEntry);
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export async function isAdmin(settings: AdSettings, user: AdUser): Promise<boolean> {
  if (!settings.adminGroup) return false;
  const normalizedGroup = settings.adminGroup.toLowerCase();
  return user.memberOf.some((g) => g.toLowerCase() === normalizedGroup);
}

export async function searchUsers(settings: AdSettings, query?: string, page = 1, pageSize = 50): Promise<{ users: AdUser[]; total: number }> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    let filter = '(&(objectClass=user)(objectCategory=person))';
    if (query) {
      const q = ldapEscape(query);
      filter = `(&(objectClass=user)(objectCategory=person)(|(sAMAccountName=*${q}*)(displayName=*${q}*)(mail=*${q}*)(givenName=*${q}*)(sn=*${q}*)(department=*${q}*)(title=*${q}*)))`;
    }

    const results = await searchLdap(client, settings.baseDN, {
      filter,
      scope: 'sub',
      attributes: AD_USER_ATTRIBUTES,
      paged: true,
    });

    const total = results.length;
    const start = (page - 1) * pageSize;
    const paged = results.slice(start, start + pageSize);

    return { users: paged.map(parseEntry), total };
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export async function getUser(settings: AdSettings, sAMAccountName: string): Promise<AdUser | null> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    const filter = `(&(objectClass=user)(objectCategory=person)(sAMAccountName=${ldapEscape(sAMAccountName)}))`;
    const results = await searchLdap(client, settings.baseDN, {
      filter,
      scope: 'sub',
      attributes: AD_USER_ATTRIBUTES,
    });

    if (results.length === 0) return null;
    return parseEntry(results[0]);
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export interface CreateUserInput {
  sAMAccountName: string;
  givenName: string;
  sn: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
  password: string;
  ou?: string; // target OU, defaults to baseDN
  enabled?: boolean;
}

export async function createUser(settings: AdSettings, input: CreateUserInput): Promise<void> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    const ou = input.ou || settings.baseDN;
    const dn = `CN=${input.displayName},${ou}`;

    // Create with UAC 544 (NORMAL_ACCOUNT + PASSWD_NOTREQD) to allow creation over plain LDAP
    const entry: Record<string, string | string[]> = {
      objectClass: ['top', 'person', 'organizationalPerson', 'user'],
      sAMAccountName: input.sAMAccountName,
      userPrincipalName: input.userPrincipalName,
      givenName: input.givenName,
      sn: input.sn,
      displayName: input.displayName,
      cn: input.displayName,
      userAccountControl: '544',
    };

    if (input.mail) entry.mail = input.mail;

    await new Promise<void>((resolve, reject) => {
      client.add(dn, entry, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Try to set password and enable account
    try {
      const quotedPassword = `"${input.password}"`;
      const passwordBuffer = Buffer.from(quotedPassword, 'utf16le');
      const pwChange = new ldap.Change({
        operation: 'replace',
        modification: new ldap.Attribute({
          type: 'unicodePwd',
          vals: [passwordBuffer],
        } as any),
      });
      await new Promise<void>((resolve, reject) => {
        client.modify(dn, [pwChange], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Password set succeeded — now set final UAC (512=enabled, 514=disabled)
      const finalUac = input.enabled !== false ? '512' : '514';
      const uacChange = new ldap.Change({
        operation: 'replace',
        modification: new ldap.Attribute({
          type: 'userAccountControl',
          values: [finalUac],
        }),
      });
      await new Promise<void>((resolve, reject) => {
        client.modify(dn, [uacChange], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (pwErr: any) {
      // Over plain LDAP, password set fails — leave account disabled (544) for safety
      console.warn('User created but password could not be set (requires LDAPS):', pwErr.message);
    }
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export async function updateUser(settings: AdSettings, dn: string, changes: Record<string, string | string[] | null>, currentUser?: AdUser): Promise<void> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    const readonlyFields = ['dn', 'thumbnailPhoto', 'sAMAccountName', 'objectClass', 'whenCreated', 'whenChanged', 'lastLogon', 'memberOf', 'userAccountControl'];
    const errors: string[] = [];

    for (const [key, value] of Object.entries(changes)) {
      if (readonlyFields.includes(key)) continue;

      const isEmpty = value === null || value === '';
      const hadValue = currentUser ? !!(currentUser as any)[key] : true;

      // Skip clearing attributes that are already empty
      if (isEmpty && !hadValue) continue;

      let modification: ldap.Change;
      if (isEmpty && hadValue) {
        // Delete existing value
        modification = new ldap.Change({
          operation: 'delete',
          modification: new ldap.Attribute({ type: key, values: [] }),
        });
      } else if (!isEmpty) {
        // Replace (works for both new and existing values)
        modification = new ldap.Change({
          operation: 'replace',
          modification: new ldap.Attribute({
            type: key,
            values: Array.isArray(value) ? value : [value!],
          }),
        });
      } else {
        continue;
      }

      // Apply each change individually so one failure doesn't block the rest
      try {
        await new Promise<void>((resolve, reject) => {
          client.modify(dn, [modification], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (err: any) {
        console.warn(`Failed to update ${key}: ${err.message}`);
        errors.push(`${key}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Some fields failed to update: ${errors.join('; ')}`);
    }
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export async function setUserEnabled(settings: AdSettings, dn: string, enabled: boolean): Promise<void> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    // Read current UAC first
    const results = await searchLdap(client, dn, {
      filter: '(objectClass=*)',
      scope: 'base',
      attributes: ['userAccountControl'],
    });

    let uac = 512;
    if (results.length > 0 && results[0].attributes) {
      for (const attr of results[0].attributes) {
        if (attr.type === 'userAccountControl') {
          uac = parseInt((attr as any).values?.[0]) || 512;
        }
      }
    }

    const UAC_DISABLE = 0x0002;
    const newUac = enabled ? (uac & ~UAC_DISABLE) : (uac | UAC_DISABLE);

    const change = new ldap.Change({
      operation: 'replace',
      modification: new ldap.Attribute({
        type: 'userAccountControl',
        values: [String(newUac)],
      }),
    });

    await new Promise<void>((resolve, reject) => {
      client.modify(dn, [change], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export async function unlockUser(settings: AdSettings, dn: string): Promise<void> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    const change = new ldap.Change({
      operation: 'replace',
      modification: new ldap.Attribute({
        type: 'lockoutTime',
        values: ['0'],
      }),
    });

    await new Promise<void>((resolve, reject) => {
      client.modify(dn, [change], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export async function deleteUser(settings: AdSettings, dn: string): Promise<void> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    await new Promise<void>((resolve, reject) => {
      client.del(dn, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export async function updateUserPhoto(settings: AdSettings, dn: string, photoBuffer: Buffer): Promise<void> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    const change = new ldap.Change({
      operation: 'replace',
      modification: new ldap.Attribute({
        type: 'thumbnailPhoto',
        vals: [photoBuffer],
      } as any),
    });

    await new Promise<void>((resolve, reject) => {
      client.modify(dn, [change], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export async function deleteUserPhoto(settings: AdSettings, dn: string): Promise<void> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    const change = new ldap.Change({
      operation: 'delete',
      modification: new ldap.Attribute({
        type: 'thumbnailPhoto',
        values: [],
      }),
    });

    await new Promise<void>((resolve, reject) => {
      client.modify(dn, [change], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export async function resetPassword(settings: AdSettings, dn: string, newPassword: string): Promise<void> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    // AD requires password as UTF-16LE encoded, surrounded by quotes
    const quotedPassword = `"${newPassword}"`;
    const passwordBuffer = Buffer.from(quotedPassword, 'utf16le');

    const change = new ldap.Change({
      operation: 'replace',
      modification: new ldap.Attribute({
        type: 'unicodePwd',
        vals: [passwordBuffer],
      } as any),
    });

    await new Promise<void>((resolve, reject) => {
      client.modify(dn, [change], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export interface AdGroup {
  dn: string;
  cn: string;
  description: string;
}

export async function searchGroups(settings: AdSettings, query?: string): Promise<AdGroup[]> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    let filter = '(objectClass=group)';
    if (query) {
      const q = ldapEscape(query);
      filter = `(&(objectClass=group)(|(cn=*${q}*)(description=*${q}*)))`;
    }

    // Search from domain root (DC=...) since groups may be outside the configured user OU
    const domainRoot = settings.baseDN.split(',').filter((p) => p.trim().toUpperCase().startsWith('DC=')).join(',') || settings.baseDN;

    const results = await searchLdap(client, domainRoot, {
      filter,
      scope: 'sub',
      attributes: ['dn', 'cn', 'description'],
      paged: true,
    });

    return results.map((entry) => {
      const attrs: Record<string, any> = {};
      if (entry.attributes) {
        for (const attr of entry.attributes) {
          const vals = (attr as any).values || [];
          attrs[attr.type] = vals.length === 1 ? vals[0] : vals;
        }
      }
      return {
        dn: entry.dn?.toString() ?? '',
        cn: attrs['cn'] || '',
        description: Array.isArray(attrs['description']) ? attrs['description'][0] : (attrs['description'] || ''),
      };
    });
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export async function addUserToGroup(settings: AdSettings, userDn: string, groupDn: string): Promise<void> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    const change = new ldap.Change({
      operation: 'add',
      modification: new ldap.Attribute({
        type: 'member',
        values: [userDn],
      }),
    });

    await new Promise<void>((resolve, reject) => {
      client.modify(groupDn, [change], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export async function removeUserFromGroup(settings: AdSettings, userDn: string, groupDn: string): Promise<void> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    const change = new ldap.Change({
      operation: 'delete',
      modification: new ldap.Attribute({
        type: 'member',
        values: [userDn],
      }),
    });

    await new Promise<void>((resolve, reject) => {
      client.modify(groupDn, [change], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

export async function testConnection(settings: AdSettings): Promise<{ success: boolean; message: string; userCount?: number }> {
  const client = createClient(settings);
  try {
    await bindClient(client, settings.bindDN, settings.bindPassword);

    const results = await searchLdap(client, settings.baseDN, {
      filter: '(&(objectClass=user)(objectCategory=person))',
      scope: 'sub',
      attributes: ['sAMAccountName'],
      paged: true,
    });

    return { success: true, message: `Connected successfully. Found ${results.length} user(s).`, userCount: results.length };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  } finally {
    try { await unbindClient(client); } catch {}
  }
}

function ldapEscape(str: string): string {
  // RFC 4515 — escape ALL special LDAP filter chars + control chars
  return str.replace(/[\\*()\x00\x01-\x1f\x7f]/g, (ch) => '\\' + ch.charCodeAt(0).toString(16).padStart(2, '0'));
}
