import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';

export const revalidate = 0;

type ServiceStatus = 'operational' | 'degraded' | 'outage';

interface ServiceResult {
  name: string;
  status: ServiceStatus;
  latency: number | null;
  description: string;
}

async function checkDatabase(): Promise<ServiceResult> {
  const start = Date.now();
  try {
    const supabase = serviceClient();
    const { error } = await supabase.from('players').select('username').limit(1);
    const latency = Date.now() - start;
    if (error) {
      return { name: 'Database', status: 'outage', latency, description: error.message };
    }
    return {
      name: 'Database',
      status: latency > 2000 ? 'degraded' : 'operational',
      latency,
      description: latency > 2000 ? 'Slow response' : 'Responding normally',
    };
  } catch (e) {
    return { name: 'Database', status: 'outage', latency: Date.now() - start, description: String(e) };
  }
}

async function checkPlayerUpdates(): Promise<ServiceResult> {
  try {
    const supabase = serviceClient();

    // Prefer the tracker_heartbeat table if the tracker is running.
    // Fall back to scanning players.last_fetched_at when the tracker hasn't
    // written a heartbeat yet (e.g. first deploy).
    const { data: hb } = await supabase
      .from('tracker_heartbeat')
      .select('status, last_seen, metadata')
      .eq('service', 'players')
      .maybeSingle();

    if (hb?.last_seen) {
      const ageMs = Date.now() - new Date(hb.last_seen).getTime();
      const ageMins = Math.floor(ageMs / 60000);
      const ageHrs = Math.floor(ageMins / 60);

      // Tracker heartbeat is written every 60 s; >30 min without one = degraded.
      let status: ServiceStatus;
      let description: string;

      if (hb.status !== 'ok') {
        status = 'degraded';
        description = `Tracker reported: ${hb.status} (${ageMins}m ago)`;
      } else if (ageMins < 30) {
        status = 'operational';
        description = `Tracker running · last seen ${ageMins}m ago`;
      } else if (ageHrs < 6) {
        status = 'degraded';
        description = `Tracker stalled · last seen ${ageHrs}h ago`;
      } else {
        status = 'outage';
        description = `Tracker offline · last seen ${ageHrs}h ago`;
      }

      return { name: 'Player Updates', status, latency: null, description };
    }

    // Fallback: check players table
    const { data, error } = await supabase
      .from('players')
      .select('last_fetched_at')
      .order('last_fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data?.last_fetched_at) {
      return { name: 'Player Updates', status: 'degraded', latency: null, description: 'No recent updates found' };
    }

    const ageMs = Date.now() - new Date(data.last_fetched_at).getTime();
    const ageMins = Math.floor(ageMs / 60000);
    const ageHrs = Math.floor(ageMins / 60);

    let description: string;
    let status: ServiceStatus;

    if (ageMins < 60) {
      description = `Last run ${ageMins}m ago`;
      status = 'operational';
    } else if (ageHrs < 6) {
      description = `Last run ${ageHrs}h ago`;
      status = 'degraded';
    } else {
      description = `Last run ${ageHrs}h ago — may be stale`;
      status = 'degraded';
    }

    return { name: 'Player Updates', status, latency: null, description };
  } catch (e) {
    return { name: 'Player Updates', status: 'outage', latency: null, description: String(e) };
  }
}

async function checkFeroxApi(): Promise<ServiceResult> {
  const start = Date.now();
  try {
    const res = await fetch('https://ferox.ps', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      return { name: 'Ferox.ps', status: 'degraded', latency, description: `HTTP ${res.status}` };
    }
    return {
      name: 'Ferox.ps',
      status: latency > 3000 ? 'degraded' : 'operational',
      latency,
      description: latency > 3000 ? 'Slow response' : 'Reachable',
    };
  } catch {
    return { name: 'Ferox.ps', status: 'outage', latency: Date.now() - start, description: 'Unreachable' };
  }
}

async function checkGETracker(): Promise<ServiceResult> {
  try {
    const supabase = serviceClient();
    const { data: hb } = await supabase
      .from('tracker_heartbeat')
      .select('status, last_seen')
      .eq('service', 'ge')
      .maybeSingle();

    if (!hb?.last_seen) {
      return { name: 'GE Tracker', status: 'degraded', latency: null, description: 'No heartbeat yet' };
    }

    const ageMs = Date.now() - new Date(hb.last_seen).getTime();
    const ageMins = Math.floor(ageMs / 60000);

    if (hb.status !== 'ok') {
      return { name: 'GE Tracker', status: 'degraded', latency: null, description: `Tracker reported: ${hb.status}` };
    }
    if (ageMins < 30) {
      return { name: 'GE Tracker', status: 'operational', latency: null, description: `Last run ${ageMins}m ago` };
    }
    const ageHrs = Math.floor(ageMins / 60);
    return {
      name: 'GE Tracker',
      status: ageHrs < 6 ? 'degraded' : 'outage',
      latency: null,
      description: `Last run ${ageHrs}h ago`,
    };
  } catch (e) {
    return { name: 'GE Tracker', status: 'outage', latency: null, description: String(e) };
  }
}

export async function GET() {
  const [db, updates, ge, ferox] = await Promise.all([
    checkDatabase(),
    checkPlayerUpdates(),
    checkGETracker(),
    checkFeroxApi(),
  ]);

  const website: ServiceResult = {
    name: 'Website',
    status: 'operational',
    latency: null,
    description: 'Running normally',
  };

  const services = [website, db, updates, ge, ferox];

  const overall: ServiceStatus = services.some((s) => s.status === 'outage')
    ? 'outage'
    : services.some((s) => s.status === 'degraded')
    ? 'degraded'
    : 'operational';

  return NextResponse.json({
    status: overall,
    checkedAt: new Date().toISOString(),
    services,
  });
}
