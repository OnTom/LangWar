import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { IS_PRODUCTION } from '../config.js';

// Bezpečnostní hlavičky. CSP povolí jen vlastní skripty; inline styly potřebujeme
// pro šířky ukazatelů (style="width: …").
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      // Na localhostu bez HTTPS by přesměrování na https rozbilo vývoj
      'upgrade-insecure-requests': IS_PRODUCTION ? [] : null,
    },
  },
});

function limiter({ windowMinutes, limit, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    // Automatické testy posílají spoustu požadavků z jedné adresy
    skip: () => process.env.NODE_ENV === 'test',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: message }),
  });
}

// Hádání hesel: 10 neúspěšných pokusů za 15 minut z jedné IP
export const loginLimiter = limiter({
  windowMinutes: 15,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Příliš mnoho pokusů o přihlášení. Strážný tě na chvíli nepustí dál. Zkus to za 15 minut.',
});

// Hromadné zakládání účtů: 5 registrací za hodinu z jedné IP
export const registerLimiter = limiter({
  windowMinutes: 60,
  limit: 5,
  message: 'Z tohohle místa se dnes narodilo hrdinů až dost. Zkus to později.',
});

// Celé API: 300 požadavků za minutu z jedné IP
export const apiLimiter = limiter({
  windowMinutes: 1,
  limit: 300,
  message: 'Moc rychle! Ani hobit na kofeinu takhle neklikal. Chvilku počkej.',
});
