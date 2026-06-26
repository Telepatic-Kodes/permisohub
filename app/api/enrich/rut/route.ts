import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface CompanyData {
  razon_social: string;
  giro: string;
}

interface SuccessResponse {
  ok: true;
  rut_formateado: string;
  razon_social: string;
  giro: string;
  simulated: true;
}

interface ErrorResponse {
  ok: false;
  error: string;
}

const KNOWN_COMPANIES: Record<string, CompanyData> = {
  '93308000': { razon_social: 'Parque Arauco S.A.', giro: 'Centros comerciales' },
  '96617940': { razon_social: 'Mall Plaza S.A.', giro: 'Administración de centros comerciales' },
  '76091011': { razon_social: 'Cencosud Shopping Centers S.A.', giro: 'Administración de centros comerciales' },
  '76354771': { razon_social: 'Inmobiliaria Mall Viña del Mar S.A.', giro: 'Centros comerciales' },
  '96501140': { razon_social: 'Plaza Vespucio S.A.', giro: 'Centros comerciales' },
};

function computeCheckDigit(body: string): string {
  const digits = body.split('').reverse().map(Number);
  const multipliers = [2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += (digits[i] ?? 0) * (multipliers[i % multipliers.length] ?? 2);
  }
  const check = 11 - (sum % 11);
  if (check === 11) return '0';
  if (check === 10) return 'K';
  return String(check);
}

function validateRut(raw: string): { valid: false } | { valid: true; body: string; check: string } {
  const stripped = raw.replace(/\./g, '').replace(/-/g, '').toUpperCase();
  if (stripped.length < 2) return { valid: false };

  const body = stripped.slice(0, -1);
  const check = stripped.slice(-1);

  if (!/^\d+$/.test(body)) return { valid: false };
  if (!/^[\dK]$/.test(check)) return { valid: false };

  const computed = computeCheckDigit(body);
  if (computed !== check) return { valid: false };

  return { valid: true, body, check };
}

function formatRut(body: string, check: string): string {
  const reversed = body.split('').reverse();
  const groups: string[] = [];
  for (let i = 0; i < reversed.length; i += 3) {
    groups.push(reversed.slice(i, i + 3).reverse().join(''));
  }
  return groups.reverse().join('.') + '-' + check;
}

function mockCompany(body: string): CompanyData {
  const suffix = body.slice(-4);
  return {
    razon_social: `Empresa Inmobiliaria ${suffix} S.A.`,
    giro: 'Actividades inmobiliarias',
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });

  const rateLimit = await checkRateLimit(`general:${user.id}`);
  if (rateLimit) return rateLimit as NextResponse<SuccessResponse | ErrorResponse>;

  const { searchParams } = new URL(request.url);
  const rutParam = searchParams.get('rut');

  if (!rutParam) {
    return NextResponse.json({ ok: false, error: 'RUT inválido' }, { status: 400 });
  }

  const result = validateRut(rutParam);

  if (!result.valid) {
    return NextResponse.json({ ok: false, error: 'RUT inválido' }, { status: 400 });
  }

  const { body, check } = result;
  const company = KNOWN_COMPANIES[body] ?? mockCompany(body);

  return NextResponse.json({
    ok: true,
    rut_formateado: formatRut(body, check),
    razon_social: company.razon_social,
    giro: company.giro,
    simulated: true,
  });
}
