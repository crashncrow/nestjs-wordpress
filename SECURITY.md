# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Report them privately through GitHub: on this repository's **Security** tab, choose **Report a vulnerability** ([direct link](https://github.com/crashncrow/nestjs-wordpress/security/advisories/new)).

Include what's affected (version or commit, and the entry point, such as the webhook controller or the WordPress plugin), how to reproduce it, and what an attacker could do. Don't include real secrets or application passwords.

You'll get an answer as soon as possible. Once a fix is ready, we'll agree on when to publish the advisory and credit you if you want.

## Supported versions

nestjs-wordpress is pre-1.0 (`0.x`). Fixes go into the latest version only.

## Scope

In scope: this library's code, the WordPress plugin and the demo apps. For example:

- webhook signature verification (`HmacSignatureGuard`, replay window, raw-body handling) and the plugin's signing;
- handling of the WordPress application password, which should only be sent for preview reads and menus;
- preview reads leaking into the cache or into public responses;
- the Next.js demo's signed `/api/revalidate` route.

Out of scope here: problems in WordPress, NestJS, Next.js, `cacheable` or Redis. Report those to their maintainers. If one of them affects how nestjs-wordpress should be used, an issue describing the impact on nestjs-wordpress (without exploit details) is welcome.
