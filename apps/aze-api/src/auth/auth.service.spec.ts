import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaClientKnownRequestError } from '../../generated/prisma/runtime/library';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    create: jest.fn(),
    findUserByEmail: jest.fn(),
  };

  const mockJwtService = { sign: jest.fn(() => 'signed.jwt.token') };

  beforeEach(async () => {
    jest.resetAllMocks();
    mockJwtService.sign.mockReturnValue('signed.jwt.token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('stores a hash of the password, never the password itself', async () => {
      mockUsersService.findUserByEmail.mockResolvedValue(null);
      mockUsersService.create.mockImplementation(async (data) => ({
        id: 'user-1',
        email: data.email,
        name: data.name ?? null,
        password: data.password,
      }));

      await service.register({ email: 'ada@example.com', password: 'correct horse' });

      const stored = mockUsersService.create.mock.calls[0][0].password;
      expect(stored).not.toBe('correct horse');
      expect(await compare('correct horse', stored)).toBe(true);
    });

    it('rejects an email that is already registered', async () => {
      mockUsersService.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'ada@example.com',
        password: await hash('correct horse', 10),
      });

      await expect(
        service.register({ email: 'ada@example.com', password: 'another one' }),
      ).rejects.toThrow(ConflictException);
      expect(mockUsersService.create).not.toHaveBeenCalled();
    });

    it('rejects an email already taken by a concurrent registration', async () => {
      mockUsersService.findUserByEmail.mockResolvedValue(null);
      mockUsersService.create.mockRejectedValue(
        new PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.register({ email: 'ada@example.com', password: 'correct horse' }),
      ).rejects.toThrow(ConflictException);
    });

    it.each([
      ['a missing password', { email: 'ada@example.com' }],
      ['an empty password', { email: 'ada@example.com', password: '' }],
      ['a non-string password', { email: 'ada@example.com', password: 12345 }],
      ['a missing email', { password: 'correct horse' }],
      ['a blank email', { email: '   ', password: 'correct horse' }],
    ])('rejects %s with a bad request', async (_case, input) => {
      mockUsersService.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.register(input as Parameters<AuthService['register']>[0]),
      ).rejects.toThrow(BadRequestException);
      expect(mockUsersService.create).not.toHaveBeenCalled();
    });

    it('rejects a password longer than bcrypt will read', async () => {
      mockUsersService.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.register({ email: 'ada@example.com', password: 'a'.repeat(73) }),
      ).rejects.toThrow(BadRequestException);
      expect(mockUsersService.create).not.toHaveBeenCalled();
    });

    it('registers the email in a single canonical form', async () => {
      mockUsersService.findUserByEmail.mockResolvedValue(null);
      mockUsersService.create.mockImplementation(async (data) => ({
        id: 'user-1',
        email: data.email,
      }));

      await service.register({ email: '  Ada@Example.COM ', password: 'correct horse' });

      expect(mockUsersService.findUserByEmail).toHaveBeenCalledWith('ada@example.com');
      expect(mockUsersService.create.mock.calls[0][0].email).toBe('ada@example.com');
    });
  });

  describe('authenticate', () => {
    it('issues a token when the password matches the stored hash', async () => {
      mockUsersService.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'ada@example.com',
        password: await hash('correct horse', 10),
      });

      const result = await service.authenticate({
        email: 'ada@example.com',
        password: 'correct horse',
      });

      expect(result).toEqual({
        userId: 'user-1',
        email: 'ada@example.com',
        accessToken: 'signed.jwt.token',
      });
    });

    it('rejects a stored plain-text password that equals the submitted one', async () => {
      mockUsersService.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'ada@example.com',
        password: 'correct horse',
      });

      await expect(
        service.authenticate({ email: 'ada@example.com', password: 'correct horse' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an unknown email', async () => {
      mockUsersService.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.authenticate({ email: 'nobody@example.com', password: 'correct horse' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    // A registered email must not fail differently from an unregistered one, or
    // the difference tells an anonymous caller which emails hold an account.
    it('rejects a malformed body the same way whether or not the email is registered', async () => {
      const registered = {
        id: 'user-1',
        email: 'ada@example.com',
        password: await hash('correct horse', 10),
      };

      mockUsersService.findUserByEmail.mockResolvedValue(registered);
      await expect(
        service.authenticate({ email: 'ada@example.com' } as never),
      ).rejects.toThrow(BadRequestException);

      mockUsersService.findUserByEmail.mockResolvedValue(null);
      await expect(
        service.authenticate({ email: 'nobody@example.com' } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('logs in with the email in any case it was typed', async () => {
      mockUsersService.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'ada@example.com',
        password: await hash('correct horse', 10),
      });

      const result = await service.authenticate({
        email: ' Ada@Example.COM ',
        password: 'correct horse',
      });

      expect(mockUsersService.findUserByEmail).toHaveBeenCalledWith('ada@example.com');
      expect(result).toMatchObject({ userId: 'user-1' });
    });
  });
});
