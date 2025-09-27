/**
 * Secrets Management Integration Tests
 */

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../../src/app');
const setupTestDB = require('../../utils/setupTestDB');
const { userOne, admin, insertUsers } = require('../../fixtures/user.fixture');
const { userOneAccessToken, adminAccessToken } = require('../../fixtures/token.fixture');
const credentialService = require('../../../src/services/credential.service');
const keyRotationService = require('../../../src/services/key-rotation.service');

setupTestDB();

describe('Secrets Management Routes', () => {
  beforeEach(async () => {
    await insertUsers([userOne, admin]);
  });

  describe('GET /admin/secrets/health', () => {
    test('should return 200 and secrets manager health status', async () => {
      const res = await request(app)
        .get('/admin/secrets/health')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        status: 'success',
        data: expect.objectContaining({
          status: expect.any(String),
          provider: expect.any(String),
          cacheEnabled: expect.any(Boolean),
          cacheSize: expect.any(Number),
          lastChecked: expect.any(String),
        }),
      });
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .get('/admin/secrets/health')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .get('/admin/secrets/health')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('POST /admin/secrets/test-connection', () => {
    test('should return 200 and connection test result', async () => {
      const res = await request(app)
        .post('/admin/secrets/test-connection')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        status: 'success',
        data: expect.objectContaining({
          connected: expect.any(Boolean),
          timestamp: expect.any(String),
        }),
      });
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .post('/admin/secrets/test-connection')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .post('/admin/secrets/test-connection')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('POST /admin/secrets/clear-cache', () => {
    test('should return 200 and clear secrets cache', async () => {
      const res = await request(app)
        .post('/admin/secrets/clear-cache')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        status: 'success',
        message: 'Secrets cache cleared successfully',
      });
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .post('/admin/secrets/clear-cache')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .post('/admin/secrets/clear-cache')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('GET /admin/secrets/key-rotation/status', () => {
    test('should return 200 and key rotation status', async () => {
      const res = await request(app)
        .get('/admin/secrets/key-rotation/status')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        status: 'success',
        data: expect.objectContaining({
          enabled: expect.any(Boolean),
          isRotating: expect.any(Boolean),
          intervalHours: expect.any(Number),
          jobActive: expect.any(Boolean),
        }),
      });
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .get('/admin/secrets/key-rotation/status')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .get('/admin/secrets/key-rotation/status')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('POST /admin/secrets/key-rotation/perform', () => {
    test('should return 200 and perform key rotation', async () => {
      // Mock successful rotation
      jest.spyOn(keyRotationService, 'performRotation').mockResolvedValue({
        success: true,
        duration: 1000,
        newKeyVersion: 'test-version-123',
        lastRotation: new Date(),
        nextRotation: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/admin/secrets/key-rotation/perform')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ force: false })
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        status: 'success',
        data: expect.objectContaining({
          success: true,
          duration: expect.any(Number),
          newKeyVersion: expect.any(String),
        }),
      });

      keyRotationService.performRotation.mockRestore();
    });

    test('should return 500 for failed key rotation', async () => {
      // Mock failed rotation
      jest.spyOn(keyRotationService, 'performRotation').mockResolvedValue({
        success: false,
        duration: 500,
        error: 'KMS connection failed',
      });

      const res = await request(app)
        .post('/admin/secrets/key-rotation/perform')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ force: false })
        .expect(httpStatus.INTERNAL_SERVER_ERROR);

      expect(res.body).toEqual({
        status: 'error',
        data: expect.objectContaining({
          success: false,
          error: 'KMS connection failed',
        }),
      });

      keyRotationService.performRotation.mockRestore();
    });

    test('should accept force parameter', async () => {
      jest.spyOn(keyRotationService, 'performRotation').mockResolvedValue({
        success: true,
        duration: 1000,
        newKeyVersion: 'test-version-123',
      });

      await request(app)
        .post('/admin/secrets/key-rotation/perform')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ force: true })
        .expect(httpStatus.OK);

      expect(keyRotationService.performRotation).toHaveBeenCalledWith(true);

      keyRotationService.performRotation.mockRestore();
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .post('/admin/secrets/key-rotation/perform')
        .send({ force: false })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .post('/admin/secrets/key-rotation/perform')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ force: false })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('POST /admin/secrets/key-rotation/test', () => {
    test('should return 200 and test key rotation', async () => {
      // Mock successful test
      jest.spyOn(keyRotationService, 'testRotation').mockResolvedValue({
        success: true,
        message: 'Key rotation test completed successfully',
        secretsManagerConnected: true,
      });

      const res = await request(app)
        .post('/admin/secrets/key-rotation/test')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        status: 'success',
        data: expect.objectContaining({
          success: true,
          message: expect.any(String),
          secretsManagerConnected: true,
        }),
      });

      keyRotationService.testRotation.mockRestore();
    });

    test('should return 500 for failed test', async () => {
      // Mock failed test
      jest.spyOn(keyRotationService, 'testRotation').mockResolvedValue({
        success: false,
        error: 'Secrets manager connection test failed',
      });

      const res = await request(app)
        .post('/admin/secrets/key-rotation/test')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.INTERNAL_SERVER_ERROR);

      expect(res.body).toEqual({
        status: 'error',
        data: expect.objectContaining({
          success: false,
          error: expect.any(String),
        }),
      });

      keyRotationService.testRotation.mockRestore();
    });
  });

  describe('GET /admin/secrets/key-rotation/history', () => {
    test('should return 200 and rotation history', async () => {
      const res = await request(app)
        .get('/admin/secrets/key-rotation/history')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        status: 'success',
        data: expect.objectContaining({
          history: expect.any(Array),
          count: expect.any(Number),
        }),
      });
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .get('/admin/secrets/key-rotation/history')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .get('/admin/secrets/key-rotation/history')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('POST /admin/secrets/key-rotation/toggle', () => {
    test('should return 200 and enable key rotation', async () => {
      jest.spyOn(keyRotationService, 'scheduleRotation').mockImplementation(() => {});
      jest.spyOn(keyRotationService, 'getRotationStatus').mockReturnValue({
        enabled: true,
        isRotating: false,
        jobActive: true,
      });

      const res = await request(app)
        .post('/admin/secrets/key-rotation/toggle')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ enabled: true })
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        status: 'success',
        message: 'Key rotation enabled successfully',
        data: expect.objectContaining({
          enabled: true,
          jobActive: true,
        }),
      });

      expect(keyRotationService.scheduleRotation).toHaveBeenCalled();

      keyRotationService.scheduleRotation.mockRestore();
      keyRotationService.getRotationStatus.mockRestore();
    });

    test('should return 200 and disable key rotation', async () => {
      jest.spyOn(keyRotationService, 'stopRotation').mockImplementation(() => {});
      jest.spyOn(keyRotationService, 'getRotationStatus').mockReturnValue({
        enabled: false,
        isRotating: false,
        jobActive: false,
      });

      const res = await request(app)
        .post('/admin/secrets/key-rotation/toggle')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ enabled: false })
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        status: 'success',
        message: 'Key rotation disabled successfully',
        data: expect.objectContaining({
          enabled: false,
          jobActive: false,
        }),
      });

      expect(keyRotationService.stopRotation).toHaveBeenCalled();

      keyRotationService.stopRotation.mockRestore();
      keyRotationService.getRotationStatus.mockRestore();
    });

    test('should return 400 error if enabled field is missing', async () => {
      await request(app)
        .post('/admin/secrets/key-rotation/toggle')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({})
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app)
        .post('/admin/secrets/key-rotation/toggle')
        .send({ enabled: true })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if user is not admin', async () => {
      await request(app)
        .post('/admin/secrets/key-rotation/toggle')
        .set('Authorization', `Bearer ${userOneAccessToken}`)
        .send({ enabled: true })
        .expect(httpStatus.FORBIDDEN);
    });
  });
});