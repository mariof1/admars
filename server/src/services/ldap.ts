import { Client, Change, Attribute } from 'ldapts';
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
  return new Client({
    url: settings.url,
    tlsOptions: {
      rejectUnauthorized: false,
    },
    connectTimeout: 10000,
    timeout: 10000,
  });
}

function parseEntry(entry: Record<string, any>): AdUser {
  const get = (key: string): any => {
    const v = entry[key];
    if (v === undefined || v === null) return '';
    if (Array.isArray(v)) return v.length === 0 ? '' : v.length === 1 ? v[0] : v;
    return v;
  };
  const getArr = (key: string): string[] => {
    const v = entry[key];
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  };

  let thumbnailPhoto: string | undefined;
  if (entry.thumbnailPhoto) {
    const photo = entry.thumbnailPhoto;
    if (Buffer.isBuffer(photo)) {
      thumbnailPhoto = photo.toString('base64');
    } else if (typeof photo === 'string') {
      thumbnailPhoto = photo;
    }
  }

  return {
    dn: entry.dn ?? '',
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
    lockoutTime: (() => {
      const v = get('lockoutTime');
      if (!v || (Array.isArray(v) && v.length === 0)) return '0';
      return Array.isArray(v) ? v[0] : String(v);
    })(),
    userAccountControl: parseInt(get('userAccountControl')) || 0,
    whenCreated: get('whenCreated'),
    whenChanged: get('whenChanged'),
    lastLogon: get('lastLogon'),
    memberOf: getArr('memberOf'),
    thumbnailPhoto,
  };
}

export async function authenticate(settings: AdSettings, username: string, password: string): Promise<{ user: AdUser | null; error?: string }> {
  const client = createClient(settings);
  try {
    // First bind with service account to find user DN
    await client.bind(settings.bindDN, settings.bindPassword);

    const filter = `(&(objectClass=user)(objectCategory=person)(|(sAMAccountName=${ldapEscape(username)})(userPrincipalName=${ldapEscape(username)})))`;
    const { searchEntries } = await client.search(settings.baseDN, {
      filter,
      scope: 'sub',
      attributes: AD_USER_ATTRIBUTES,
    });

    if (searchEntries.length === 0) return { user: null };

    const userEntry = searchEntries[0];
    const userDn = userEntry.dn;
    if (!userDn) return { user: null };

    const user = parseEntry(userEntry);

    // Check disabled BEFORE attempting bind to avoid contributing to lockout
    const UAC_ACCOUNTDISABLE = 0x0002;
    if (user.userAccountControl & UAC_ACCOUNTDISABLE) {
      return { user: null, error: 'Account is disabled' };
    }

    // Check locked BEFORE attempting bind
    if (user.lockoutTime && user.lockoutTime !== '0') {
      return { user: null, error: 'Account is locked' };
    }

    await client.unbind();

    // Re-bind as the user to verify password
    const userClient = createClient(settings);
    try {
      await userClient.bind(userDn, password);
      await userClient.unbind();
    } catch {
      return { user: null, error: 'Invalid credentials' };
    }

    return { user };
  } finally {
    try { await client.unbind(); } catch {}
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
    await client.bind(settings.bindDN, settings.bindPassword);

    let filter = '(&(objectClass=user)(objectCategory=person))';
    if (query) {
      const q = ldapEscape(query);
      filter = `(&(objectClass=user)(objectCategory=person)(|(sAMAccountName=*${q}*)(displayName=*${q}*)(mail=*${q}*)(givenName=*${q}*)(sn=*${q}*)(department=*${q}*)(title=*${q}*)))`;
    }

    const { searchEntries } = await client.search(settings.baseDN, {
      filter,
      scope: 'sub',
      attributes: AD_USER_ATTRIBUTES,
      paged: true,
    });

    const total = searchEntries.length;
    const start = (page - 1) * pageSize;
    const paged = searchEntries.slice(start, start + pageSize);

    return { users: paged.map(parseEntry), total };
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export async function getUser(settings: AdSettings, sAMAccountName: string): Promise<AdUser | null> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    const filter = `(&(objectClass=user)(objectCategory=person)(sAMAccountName=${ldapEscape(sAMAccountName)}))`;
    const { searchEntries } = await client.search(settings.baseDN, {
      filter,
      scope: 'sub',
      attributes: AD_USER_ATTRIBUTES,
    });

    if (searchEntries.length === 0) return null;
    return parseEntry(searchEntries[0]);
  } finally {
    try { await client.unbind(); } catch {}
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
    await client.bind(settings.bindDN, settings.bindPassword);

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

    await client.add(dn, entry);

    // Try to set password and enable account
    try {
      const quotedPassword = `"${input.password}"`;
      const passwordBuffer = Buffer.from(quotedPassword, 'utf16le');
      const pwChange = new Change({
        operation: 'replace',
        modification: new Attribute({
          type: 'unicodePwd',
          values: [passwordBuffer],
        }),
      });
      await client.modify(dn, [pwChange]);

      // Password set succeeded — now set final UAC (512=enabled, 514=disabled)
      const finalUac = input.enabled !== false ? '512' : '514';
      const uacChange = new Change({
        operation: 'replace',
        modification: new Attribute({
          type: 'userAccountControl',
          values: [finalUac],
        }),
      });
      await client.modify(dn, [uacChange]);
    } catch (pwErr: any) {
      // Over plain LDAP, password set fails — leave account disabled (544) for safety
      console.warn('User created but password could not be set (requires LDAPS):', pwErr.message);
    }
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export async function updateUser(settings: AdSettings, dn: string, changes: Record<string, string | string[] | null>, currentUser?: AdUser): Promise<void> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    const readonlyFields = ['dn', 'thumbnailPhoto', 'sAMAccountName', 'objectClass', 'whenCreated', 'whenChanged', 'lastLogon', 'memberOf', 'userAccountControl'];
    const errors: string[] = [];

    for (const [key, value] of Object.entries(changes)) {
      if (readonlyFields.includes(key)) continue;

      const isEmpty = value === null || value === '';
      const hadValue = currentUser ? !!(currentUser as any)[key] : true;

      // Skip clearing attributes that are already empty
      if (isEmpty && !hadValue) continue;

      let modification: Change;
      if (isEmpty && hadValue) {
        // Delete existing value
        modification = new Change({
          operation: 'delete',
          modification: new Attribute({ type: key, values: [] }),
        });
      } else if (!isEmpty) {
        // Replace (works for both new and existing values)
        modification = new Change({
          operation: 'replace',
          modification: new Attribute({
            type: key,
            values: Array.isArray(value) ? value : [value!],
          }),
        });
      } else {
        continue;
      }

      // Apply each change individually so one failure doesn't block the rest
      try {
        await client.modify(dn, [modification]);
      } catch (err: any) {
        console.warn(`Failed to update ${key}: ${err.message}`);
        errors.push(`${key}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Some fields failed to update: ${errors.join('; ')}`);
    }
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export async function setUserEnabled(settings: AdSettings, dn: string, enabled: boolean): Promise<void> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    // Read current UAC first
    const { searchEntries } = await client.search(dn, {
      filter: '(objectClass=*)',
      scope: 'base',
      attributes: ['userAccountControl'],
    });

    let uac = 512;
    if (searchEntries.length > 0) {
      const val = searchEntries[0].userAccountControl;
      if (val !== undefined) {
        uac = parseInt(String(val)) || 512;
      }
    }

    const UAC_DISABLE = 0x0002;
    const newUac = enabled ? (uac & ~UAC_DISABLE) : (uac | UAC_DISABLE);

    const change = new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'userAccountControl',
        values: [String(newUac)],
      }),
    });

    await client.modify(dn, [change]);
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export async function unlockUser(settings: AdSettings, dn: string): Promise<void> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    const change = new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'lockoutTime',
        values: ['0'],
      }),
    });

    await client.modify(dn, [change]);
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export async function deleteUser(settings: AdSettings, dn: string): Promise<void> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    await client.del(dn);
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export async function updateUserPhoto(settings: AdSettings, dn: string, photoBuffer: Buffer): Promise<void> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    const change = new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'thumbnailPhoto',
        values: [photoBuffer],
      }),
    });

    await client.modify(dn, [change]);
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export async function deleteUserPhoto(settings: AdSettings, dn: string): Promise<void> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    const change = new Change({
      operation: 'delete',
      modification: new Attribute({
        type: 'thumbnailPhoto',
        values: [],
      }),
    });

    await client.modify(dn, [change]);
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export async function resetPassword(settings: AdSettings, dn: string, newPassword: string): Promise<void> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    // AD requires password as UTF-16LE encoded, surrounded by quotes
    const quotedPassword = `"${newPassword}"`;
    const passwordBuffer = Buffer.from(quotedPassword, 'utf16le');

    const change = new Change({
      operation: 'replace',
      modification: new Attribute({
        type: 'unicodePwd',
        values: [passwordBuffer],
      }),
    });

    await client.modify(dn, [change]);
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export interface AdOU {
  dn: string;
  name: string;
  description: string;
  depth: number;
}

export async function searchOUs(settings: AdSettings): Promise<AdOU[]> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    // Search from baseDN so only OUs within the configured scope are returned
    const { searchEntries } = await client.search(settings.baseDN, {
      filter: '(objectClass=organizationalUnit)',
      scope: 'sub',
      attributes: ['dn', 'ou', 'name', 'description'],
    });

    const baseDepth = settings.baseDN.split(',').length;

    const ous = searchEntries.map((entry) => {
      const dn = entry.dn ?? '';
      const name = String(entry.ou || entry.name || '');
      const desc = entry.description;
      const description = Array.isArray(desc) ? (desc.length > 0 ? String(desc[0]) : '') : String(desc || '');
      const depth = dn.split(',').length - baseDepth;
      return { dn, name, description, depth };
    });

    // Sort hierarchically: reverse DN components so parents group before children
    // e.g. "OU=Sub,OU=Top,DC=x" → ["DC=x","OU=Top","OU=Sub"] for comparison
    ous.sort((a, b) => {
      const aParts = a.dn.split(',').reverse();
      const bParts = b.dn.split(',').reverse();
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = (aParts[i] || '').toLowerCase();
        const bPart = (bParts[i] || '').toLowerCase();
        if (aPart !== bPart) return aPart.localeCompare(bPart);
      }
      return 0;
    });

    return ous;
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export async function moveUser(settings: AdSettings, userDn: string, targetOu: string): Promise<void> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    // Extract CN from current DN
    const cnMatch = userDn.match(/^(CN=[^,]+)/i);
    if (!cnMatch) throw new Error('Invalid user DN');

    await client.modifyDN(userDn, cnMatch[1] + ',' + targetOu);
  } finally {
    try { await client.unbind(); } catch {}
  }
}

/** Fetch available UPN suffixes from AD (default domain + any custom suffixes). */
export async function getUpnSuffixes(settings: AdSettings): Promise<string[]> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    // Default suffix derived from DC components of baseDN
    const dcParts = settings.baseDN.split(',')
      .filter(p => p.trim().toUpperCase().startsWith('DC='))
      .map(p => p.replace(/^DC=/i, ''));
    const defaultSuffix = dcParts.join('.');

    const suffixes = new Set<string>();
    if (defaultSuffix) suffixes.add(defaultSuffix);

    // Query RootDSE to find configuration naming context
    try {
      const { searchEntries: rootDse } = await client.search('', {
        scope: 'base',
        filter: '(objectClass=*)',
        attributes: ['configurationNamingContext'],
      });
      const configNC = rootDse[0]?.configurationNamingContext;
      const configDN = Array.isArray(configNC) ? (configNC[0] ?? '') : String(configNC || '');

      if (configDN) {
        // Query Partitions container for additional UPN suffixes
        const { searchEntries } = await client.search(`CN=Partitions,${configDN}`, {
          scope: 'base',
          filter: '(objectClass=*)',
          attributes: ['uPNSuffixes'],
        });

        const raw = searchEntries[0]?.uPNSuffixes;
        const vals = Array.isArray(raw) ? raw : (raw ? [raw] : []);
        for (const v of vals) {
          const s = String(v).trim();
          if (s) suffixes.add(s);
        }
      }
    } catch {
      // If config query fails, fall back to default suffix only
    }

    return [...suffixes];
  } finally {
    try { await client.unbind(); } catch {}
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
    await client.bind(settings.bindDN, settings.bindPassword);

    let filter = '(objectClass=group)';
    if (query) {
      const q = ldapEscape(query);
      filter = `(&(objectClass=group)(|(cn=*${q}*)(description=*${q}*)))`;
    }

    // Search from domain root (DC=...) since groups may be outside the configured user OU
    const domainRoot = settings.baseDN.split(',').filter((p) => p.trim().toUpperCase().startsWith('DC=')).join(',') || settings.baseDN;

    const { searchEntries } = await client.search(domainRoot, {
      filter,
      scope: 'sub',
      attributes: ['dn', 'cn', 'description', 'groupType'],
      paged: true,
    });

    // Built-in / system groups to hide from the UI
    const HIDDEN_GROUPS = new Set([
      'domain controllers',
      'domain computers',
      'domain guests',
      'domain users',
      'enterprise admins',
      'enterprise key admins',
      'key admins',
      'schema admins',
      'group policy creator owners',
      'cert publishers',
      'ras and ias servers',
      'dnsadmins',
      'dnsupdateproxy',
      'read-only domain controllers',
      'enterprise read-only domain controllers',
      'cloneable domain controllers',
      'protected users',
      'allowed rodc password replication group',
      'denied rodc password replication group',
    ]);
    // Container DNs for built-in groups
    const HIDDEN_CONTAINERS = ['cn=builtin,', 'cn=foreignsecurityprincipals,'];

    return searchEntries.map((entry) => {
      const cn = entry.cn;
      const desc = entry.description;
      return {
        dn: entry.dn ?? '',
        cn: (Array.isArray(cn) ? cn[0] : cn) || '',
        description: Array.isArray(desc) ? desc[0] : (desc || ''),
      } as AdGroup;
    }).filter((g) => {
      const cnLower = g.cn.toLowerCase();
      const dnLower = g.dn.toLowerCase();
      if (HIDDEN_GROUPS.has(cnLower)) return false;
      if (HIDDEN_CONTAINERS.some((c) => dnLower.includes(c))) return false;
      return true;
    });
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export async function addUserToGroup(settings: AdSettings, userDn: string, groupDn: string): Promise<void> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    const change = new Change({
      operation: 'add',
      modification: new Attribute({
        type: 'member',
        values: [userDn],
      }),
    });

    await client.modify(groupDn, [change]);
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export async function removeUserFromGroup(settings: AdSettings, userDn: string, groupDn: string): Promise<void> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    const change = new Change({
      operation: 'delete',
      modification: new Attribute({
        type: 'member',
        values: [userDn],
      }),
    });

    await client.modify(groupDn, [change]);
  } finally {
    try { await client.unbind(); } catch {}
  }
}

export async function testConnection(settings: AdSettings): Promise<{ success: boolean; message: string; userCount?: number }> {
  const client = createClient(settings);
  try {
    await client.bind(settings.bindDN, settings.bindPassword);

    const { searchEntries } = await client.search(settings.baseDN, {
      filter: '(&(objectClass=user)(objectCategory=person))',
      scope: 'sub',
      attributes: ['sAMAccountName'],
      paged: true,
    });

    return { success: true, message: `Connected successfully. Found ${searchEntries.length} user(s).`, userCount: searchEntries.length };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  } finally {
    try { await client.unbind(); } catch {}
  }
}

function ldapEscape(str: string): string {
  // RFC 4515 — escape ALL special LDAP filter chars + control chars
  return str.replace(/[\\*()\x00\x01-\x1f\x7f]/g, (ch) => '\\' + ch.charCodeAt(0).toString(16).padStart(2, '0'));
}
