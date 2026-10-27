"""Test the actual CPAL scheduling branch with std-only rustc, without an audio device.

Usage: python3 tests/cpal-clock.py PATCHED_MOD_RS [ORIGINAL_MOD_RS]
"""
from pathlib import Path
import subprocess
import sys

output = Path(__file__).resolve().parents[1] / '.build/cpal-clock-tests'
output.mkdir(parents=True, exist_ok=True)
tests = r'''
#[test] fn first_buffer_has_lead() { assert!((schedule(0.0, 10.0)-10.025).abs()<1e-9); }
#[test] fn valid_future_cursor_is_preserved() { assert_eq!(schedule(10.02,10.0),10.02); }
#[test] fn expired_cursor_reanchors() { assert!((schedule(10.0,12.0)-12.025).abs()<1e-9); }
#[test] fn cursor_at_now_is_valid() { assert_eq!(schedule(12.0,12.0),12.0); }
#[test] fn two_workers_after_stall_stay_sequential() {
 let step=512.0/44100.0; let now=5.5;
 let first=schedule(5.0,now); let second=schedule(first+step,now);
 assert!(first>=now); assert!((second-first-step).abs()<1e-9);
}
#[test] fn normal_double_buffer_cadence_is_not_delayed() {
 let step=512.0/44100.0;let mut cursor=10.025;
 for _ in 0..100 {let now=cursor-step;let next=schedule(cursor,now);assert_eq!(next,cursor);cursor=next+step;}
}
'''
def check(path, label, expected_success):
    text=path.read_text(encoding='utf8')
    start=text.index('if *time_at_start_of_buffer > 0.001')
    end=text.index('\n                    };',start)
    branch=text[start:end]
    code='fn schedule(cursor:f64,now:f64)->f64 { let time_at_start_of_buffer=&cursor;\n'+branch+'\n}\n'+tests
    source=output/f'{label}.rs';source.write_text(code,encoding='utf8')
    binary=output/(label+('.exe' if sys.platform=='win32' else ''))
    subprocess.run(['rustc','--edition=2021','--test',str(source),'-o',str(binary)],check=True)
    result=subprocess.run([str(binary)],capture_output=True,text=True,encoding='utf8')
    print(label+':\n'+result.stdout)
    assert (result.returncode==0)==expected_success, result.stderr
if len(sys.argv)>2:check(Path(sys.argv[2]),'before',False)
check(Path(sys.argv[1]),'after',True)
