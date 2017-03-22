#!/usr/bin/env python
import os
import sys
import json
from datetime import datetime
from Queue import Queue
from threading import Thread

#hack json dump precision
json.encoder.FLOAT_REPR = lambda o: "%.5f" % o

#pick jobs off the work queue
def work(thread_id, work_queue):
  #pick a number from 20 to 100kph
  hacked_speed = 0
  while True:
    file_path = work_queue.get()
    sys.stderr.write('%s Thread %d will amend %s' % (datetime.utcnow().strftime('%Y.%m.%d %H:%M:%S'), thread_id, file_path) + os.linesep)
    #open the geojson and update the speeds
    with open(file_path, 'r+') as handle:
      feature_collection = json.load(handle)
      for feature in feature_collection[u'features']:
        feature[u'properties'][u'speed'] = (hacked_speed % 80) + 20
        hacked_speed += 1
      #overwrite the file
      handle.seek(0)
      json.dump(feature_collection, handle, separators=(',', ':'))
      handle.truncate()
    sys.stderr.write('%s Thread %d has amended %s' % (datetime.utcnow().strftime('%Y.%m.%d %H:%M:%S'), thread_id, file_path) + os.linesep)
    work_queue.task_done()

#a place to store outstanding work
work_queue = Queue(maxsize=int(sys.argv[2]))

#workers to work on them
for thread_id in range(0, int(sys.argv[2])):
  worker = Thread(target=work, args=(thread_id, work_queue,))
  worker.setDaemon(True)
  worker.start()

#recurse over files putting onto the work queue
for path, dirs, files in os.walk(sys.argv[1]):
  for file_name in files:
    file_path = os.path.join(path, file_name)
    work_queue.put(file_path)

#wait for it to finish
work_queue.join()