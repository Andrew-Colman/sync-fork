const { executeCommand } = require('../lib/utils');
var mockIo = require('mock-stdio');

describe('executeCommand', () => {
    test('git --version', () => {
        const command = 'git --version';

        const mockExec = jest
            .fn(executeCommand)
            .mockReturnValue({ stdout: 'git version', stderr: '' });

        mockExec(command);

        expect(mockExec.mock.results[0].value).toMatchObject({
            stdout: 'git version',
            stderr: '',
        });
    });

    test('debug mode', async () => {
        mockIo.start();

        process.env.DEBUG = true;

        const command = 'git checkout master';

        await executeCommand(command);

        const result = await mockIo.end();

        expect(result.stderr).toBe(''); //no errors

        // debug mode should include this 3 strings:
        expect(result.stdout).toContain('CMD');
        expect(result.stdout).toContain('STDERR');
        expect(result.stdout).toContain('STDOUT');
    });
});
