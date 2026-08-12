import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const USER_ID = '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('looks a User up by the uuid as given', async () => {
    await controller.findMe({ user: { userId: USER_ID, email: 'ada@example.com' } });

    expect(mockUsersService.findOne).toHaveBeenCalledWith(USER_ID);
  });

  // The id comes from the verified token, never from the caller, so there is no
  // path id to swap for someone else's.
  it('reads the User the token identifies, not one the caller names', async () => {
    await controller.findMe({ user: { userId: USER_ID, email: 'ada@example.com' } });

    expect(mockUsersService.findOne).toHaveBeenCalledTimes(1);
    expect(mockUsersService.findOne).not.toHaveBeenCalledWith(expect.stringMatching(/me/));
  });
});
